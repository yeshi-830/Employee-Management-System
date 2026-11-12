import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CalendarCheck2,
  Check,
  Clock3,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ShieldCheck,
  Sun,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

type Role = 'admin' | 'hr_manager' | 'department_manager' | 'employee';

type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

type EmployeeRecord = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  jobTitle: string;
  managerId: string | null;
  hireDate: string;
  employmentStatus: 'active' | 'probation' | 'on_leave' | 'inactive';
  isArchived: boolean;
};

type DepartmentRecord = {
  id: string;
  name: string;
  description: string;
  managerId: string | null;
  employeeCount?: number;
};

type LeaveRequestRecord = {
  id: string;
  employeeId: string;
  employeeName?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
};

type LeaveTypeRecord = {
  id: string;
  name: string;
  daysAllowed: number;
};

type DashboardSummary = {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  newEmployees: number;
  pendingLeave: number;
  employeesByStatus: Array<{ status: EmployeeRecord['employmentStatus']; total: number }>;
  employeesByDepartment: Array<{ id: string; name: string; total: number }>;
  recentHires: EmployeeRecord[];
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type EmployeeFormState = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  jobTitle: string;
  managerId: string;
  hireDate: string;
  employmentStatus: EmployeeRecord['employmentStatus'];
};

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:4000/api';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isMutation = !['GET', 'HEAD'].includes(method);
  const headers = new Headers(options.headers ?? {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData) && isMutation) {
    headers.set('Content-Type', 'application/json');
  }

  const csrfToken = localStorage.getItem('ems_csrf_token');
  if (csrfToken && isMutation) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed.' }));
    throw new Error(error.message ?? 'Request failed.');
  }

  return (await response.json()) as T;
}

function App() {
  const [session, setSession] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    let active = true;
    const checkCurrentUser = async () => {
      try {
        const result = await apiFetch<{ user: User }>('/auth/me');
        if (active) setSession(result.user);
      } catch {
        if (active) setSession(null);
      } finally {
        if (active) setLoadingUser(false);
      }
    };

    void checkCurrentUser();
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const result = await apiFetch<{ user: User; csrfToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setSession(result.user);
    localStorage.setItem('ems_csrf_token', result.csrfToken);
    return result.user;
  };

  const logout = async () => {
    await apiFetch<{ message: string }>('/auth/logout', { method: 'POST' });
    setSession(null);
    localStorage.removeItem('ems_csrf_token');
  };

  if (loadingUser) {
    return <div className="page-shell centered">Loading employee workspace...</div>;
  }

  return (
    <BrowserRouter>
      {session ? (
        <AuthenticatedShell session={session} logout={logout} />
      ) : (
        <LoginPage onLogin={login} />
      )}
    </BrowserRouter>
  );
}

function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<User> }) {
  const [email, setEmail] = useState(import.meta.env.DEV ? 'hr@northstar.example' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'Password123!' : '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await onLogin(email, password);
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="brand-row">
          <div className="brand-mark">N</div>
          <div>
            <div className="eyebrow">CEO MHRU</div>
            <h1>Employee Management System</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Work email
            <input
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <div className="error-banner">{error}</div> : null}
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {import.meta.env.DEV ? (
          <div className="demo-box">
            <ShieldCheck size={18} />
            <span>Demo credentials: hr@northstar.example / Password123!</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AuthenticatedShell({ session, logout }: { session: User; logout: () => Promise<void> }) {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem('ems_theme') === 'light' ? 'light' : 'dark',
  );
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/employees', label: 'Employees', icon: Users },
    { to: '/departments', label: 'Departments', icon: Building2 },
    { to: '/leave-requests', label: 'Leave requests', icon: CalendarCheck2 },
  ].filter((item) => item.to !== '/departments' || session.role !== 'employee');
  const pageTitle = navItems.find((item) => item.to === location.pathname)?.label ?? 'Employee workspace';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ems_theme', theme);
  }, [theme]);

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await logout();
    } catch (requestError) {
      setLogoutError(requestError instanceof Error ? requestError.message : 'Unable to sign out.');
    }
  };

  return (
    <div className={`shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}${mobileNavOpen ? ' mobile-nav-open' : ''}`} data-theme={theme}>
      <aside className="sidebar">
        <div className="sidebar-heading">
          <div className="brand-row sidebar-brand">
            <div className="brand-mark">N</div>
            <div className="sidebar-brand-copy">
              <div className="eyebrow">CEO MHRU</div>
              <strong>EMS</strong>
            </div>
          </div>
          <button
            type="button"
            className="ghost-button compact sidebar-collapse-button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <button
            type="button"
            className="ghost-button compact mobile-nav-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileNavOpen(false)}
            >
              <Icon size={18} />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="user-panel">
          <div className="user-profile">
            <div className="user-avatar" aria-hidden="true">
              {session.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="user-profile-copy">
              <div className="user-name">{session.name}</div>
              <div className="user-role">{session.role.replaceAll('_', ' ')}</div>
            </div>
          </div>
          {logoutError ? <div className="error-banner logout-error">{logoutError}</div> : null}
          <button type="button" className="ghost-button logout-button" onClick={() => void handleLogout()}>
            <LogOut size={16} />
            <span className="nav-label">Sign out</span>
          </button>
        </div>
      </aside>

      {mobileNavOpen ? (
        <button
          type="button"
          className="nav-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
        />
      ) : null}

      <main className="content-panel">
        <header className="topbar">
          <div className="topbar-heading">
            <button
              type="button"
              className="ghost-button compact mobile-nav-toggle"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
            >
              <Menu size={19} />
            </button>
            <div>
              <div className="eyebrow">Workspace / {pageTitle}</div>
              <h2>{pageTitle}</h2>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="ghost-button compact theme-toggle"
              onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <div className="topbar-badge">
              <Activity size={16} />
              Protected
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage session={session} />} />
          <Route path="/employees" element={<EmployeesPage session={session} />} />
          <Route path="/departments" element={<DepartmentsPage session={session} />} />
          <Route path="/leave-requests" element={<LeavePage session={session} />} />
        </Routes>
      </main>
    </div>
  );
}

function DashboardPage({ session }: { session: User }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRecord[]>([]);
  const [todayLabel] = useState(() => formatLongDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingLeaveId, setUpdatingLeaveId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isCurrent = true;

    Promise.all([
      apiFetch<DashboardSummary>('/dashboard/summary'),
      apiFetch<{ employees: EmployeeRecord[] }>('/employees'),
      apiFetch<{ leaveRequests: LeaveRequestRecord[] }>('/leave-requests'),
    ])
      .then(([dashboard, employeeResponse, leaveResponse]) => {
        if (!isCurrent) return;
        setSummary(dashboard);
        setEmployees(employeeResponse.employees);
        setLeaveRequests(leaveResponse.leaveRequests);
        setLastUpdated(new Date());
      })
      .catch((requestError: unknown) => {
        if (isCurrent) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard data.');
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [refreshKey]);

  const refreshDashboard = () => {
    setLoading(true);
    setError('');
    setRefreshKey((current) => current + 1);
  };

  const canReviewLeave = session.role === 'admin' || session.role === 'hr_manager' || session.role === 'department_manager';

  const updateLeaveStatus = async (id: string, status: LeaveRequestRecord['status']) => {
    setUpdatingLeaveId(id);
    setActionError('');

    try {
      const result = await apiFetch<{ leaveRequest: LeaveRequestRecord }>(`/leave-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setLeaveRequests((current) => current.map((item) => (item.id === id ? result.leaveRequest : item)));
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Unable to update this leave request.');
    } finally {
      setUpdatingLeaveId(null);
    }
  };

  const exportReport = () => {
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const departmentById = new Map(summary?.employeesByDepartment.map((department) => [department.id, department.name]) ?? []);
    const rows = [
      ['Record type', 'Employee number', 'Employee name', 'Email', 'Job title', 'Department', 'Employment status', 'Leave type', 'Start date', 'End date', 'Leave status'],
      ...employees
        .filter((employee) => !employee.isArchived)
        .map((employee) => [
          'Employee',
          employee.employeeNumber,
          `${employee.firstName} ${employee.lastName}`,
          employee.email,
          employee.jobTitle,
          departmentById.get(employee.departmentId) ?? 'Unassigned',
          employee.employmentStatus,
          '',
          '',
          '',
          '',
        ]),
      ...leaveRequests.map((leave) => {
        const employee = employeeById.get(leave.employeeId);
        return [
          'Leave request',
          employee?.employeeNumber ?? '',
          employee ? `${employee.firstName} ${employee.lastName}` : leave.employeeName ?? 'Unknown employee',
          employee?.email ?? '',
          employee?.jobTitle ?? '',
          employee ? departmentById.get(employee.departmentId) ?? 'Unassigned' : '',
          employee?.employmentStatus ?? '',
          leave.leaveType,
          leave.startDate,
          leave.endDate,
          leave.status,
        ];
      }),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
            return `"${safeValue.replaceAll('"', '""')}"`;
          })
          .join(','),
      )
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ceo-mhru-workforce-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const activeEmployees = employees.filter((employee) => !employee.isArchived);
  const pendingRequests = leaveRequests.filter((request) => request.status === 'pending');
  const upcomingLeave = leaveRequests
    .filter((request) => request.status === 'approved' && new Date(`${request.endDate.slice(0, 10)}T00:00:00`) >= startOfToday())
    .sort((first, second) => first.startDate.localeCompare(second.startDate))
    .slice(0, 4);
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  const statusLabels: Record<EmployeeRecord['employmentStatus'], string> = {
    active: 'Active',
    probation: 'Probation',
    on_leave: 'On leave',
    inactive: 'Inactive',
  };
  const statusCounts = summary.employeesByStatus.map(({ status, total }) => ({
    status,
    label: statusLabels[status],
    total,
  }));
  const maxDepartmentSize = Math.max(...(summary?.employeesByDepartment.map((item) => item.total) ?? [0]), 1);
  const activeRate = summary?.totalEmployees
    ? Math.round((summary.activeEmployees / summary.totalEmployees) * 100)
    : 0;

  if (loading && !summary) {
    return <Card title="Loading dashboard">Preparing your people overview...</Card>;
  }

  if (!summary) {
    return (
      <Card title="Dashboard unavailable">
        <div className="stack">
          <div className="error-banner">{error || 'Unable to load dashboard data.'}</div>
          <div>
            <button type="button" className="ghost-button compact" onClick={refreshDashboard}>
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="dashboard stack">
      <section className="dashboard-hero">
        <div>
          <div className="eyebrow">{todayLabel}</div>
          <h1>People at a glance</h1>
          <p>Welcome back, {session.name.split(' ')[0]}. Here’s your team’s latest overview.</p>
        </div>
        <div className="dashboard-controls">
          <span className="last-updated">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Loading'}
          </span>
          <button
            type="button"
            className="ghost-button compact"
            onClick={refreshDashboard}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button type="button" className="primary-button compact" onClick={exportReport} disabled={loading}>
            <Download size={16} />
            Export report
          </button>
        </div>
      </section>

      {error ? <div className="error-banner dashboard-error">{error}</div> : null}
      {actionError ? <div className="error-banner dashboard-error">{actionError}</div> : null}

      <div className="stats-grid dashboard-stats">
        <StatCard
          label="Team members"
          value={String(summary.totalEmployees)}
          detail={`${summary.employeesByDepartment.length} departments`}
          icon={<Users size={18} />}
          tone="blue"
          to="/employees"
        />
        <StatCard
          label="Active employees"
          value={String(summary.activeEmployees)}
          detail={`${activeRate}% of current workforce`}
          icon={<Activity size={18} />}
          tone="green"
          to="/employees"
        />
        <StatCard
          label="New this month"
          value={String(summary.newEmployees)}
          detail="Hired this calendar month"
          icon={<UserPlus size={18} />}
          tone="violet"
          to="/employees"
        />
        <StatCard
          label="Inactive employees"
          value={String(summary.inactiveEmployees)}
          detail="In your current workforce view"
          icon={<Users size={18} />}
          tone="blue"
          to="/employees"
        />
        <StatCard
          label="Leave approvals"
          value={String(pendingRequests.length)}
          detail={pendingRequests.length ? 'Waiting for review' : 'Nothing waiting for review'}
          icon={<Clock3 size={18} />}
          tone="amber"
          to="/leave-requests"
        />
        <StatCard
          label="Departments"
          value={String(summary.employeesByDepartment.length)}
          detail="Across the organization"
          icon={<Building2 size={18} />}
          tone="amber"
          to={session.role !== 'employee' ? '/departments' : undefined}
        />
      </div>

      <div className="dashboard-grid">
        <Card title="Workforce composition">
          <div className="dashboard-card-content">
            <div className="workforce-summary">
              <div className="workforce-total">{summary.totalEmployees}</div>
              <div>
                <strong>People in your workforce</strong>
                <span className="muted-copy">Current employment status</span>
              </div>
            </div>
            <div className="status-breakdown">
              {statusCounts.map(({ status, label, total }) => (
                <div key={status} className="status-metric">
                  <div className="metric-row">
                    <span><i className={`legend-dot ${status}`} />{label}</span>
                    <strong>{total}</strong>
                  </div>
                  <div className="progress-track">
                    <span className={`progress-${status}`} style={{ width: `${summary.totalEmployees ? (total / summary.totalEmployees) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Department distribution">
          <div className="dashboard-card-content">
            {summary.employeesByDepartment.length ? (
              <div className="department-bars">
                {summary.employeesByDepartment
                  .slice()
                  .sort((first, second) => second.total - first.total)
                  .map((department, index) => (
                    <div className="department-bar-row" key={department.name}>
                      <div className="department-bar-label">
                        <span className={`department-marker marker-${index % 4}`} />
                        <span>{department.name}</span>
                        <strong>{department.total}</strong>
                      </div>
                      <div className="progress-track">
                        <span style={{ width: `${(department.total / maxDepartmentSize) * 100}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="empty-state">No department data available.</div>
            )}
            {session.role !== 'employee' ? (
              <NavLink to="/departments" className="text-link">
                View departments <ArrowUpRight size={15} />
              </NavLink>
            ) : null}
          </div>
        </Card>

        <Card title="Recent hires">
          <div className="dashboard-card-content">
            {summary.recentHires.length ? (
              <div className="hire-list">
                {summary.recentHires.map((hire) => (
                  <div className="hire-row" key={hire.id}>
                    <div className="avatar">{`${hire.firstName[0] ?? ''}${hire.lastName[0] ?? ''}`}</div>
                    <div className="hire-details">
                      <strong>{hire.firstName} {hire.lastName}</strong>
                      <span>{hire.jobTitle}</span>
                    </div>
                    <span className="hire-date">{formatDate(hire.hireDate)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No recent hires recorded.</div>
            )}
            <NavLink to="/employees" className="text-link">
              Browse employee directory <ArrowUpRight size={15} />
            </NavLink>
          </div>
        </Card>

        <Card title="Leave requests">
          <div className="dashboard-card-content">
            {pendingRequests.length ? (
              <div className="leave-list">
                {pendingRequests.slice(0, 3).map((request) => {
                  const employee = employeeById.get(request.employeeId);
                  return (
                    <div className="leave-row" key={request.id}>
                      <div className="leave-row-heading">
                        <div>
                          <strong>{employee ? `${employee.firstName} ${employee.lastName}` : request.employeeName ?? 'Unknown employee'}</strong>
                          <span>{request.leaveType} · {formatDate(request.startDate)} – {formatDate(request.endDate)}</span>
                        </div>
                        <span className="status-pill pending">Pending</span>
                      </div>
                      {request.reason ? <p className="leave-reason">{request.reason}</p> : null}
                      {canReviewLeave ? (
                        <div className="button-row leave-actions">
                          <button
                            type="button"
                            className="ghost-button compact success"
                            onClick={() => void updateLeaveStatus(request.id, 'approved')}
                            disabled={updatingLeaveId === request.id}
                          >
                            <Check size={15} /> Approve
                          </button>
                          <button
                            type="button"
                            className="ghost-button compact danger"
                            onClick={() => void updateLeaveStatus(request.id, 'rejected')}
                            disabled={updatingLeaveId === request.id}
                          >
                            <X size={15} /> Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">You’re all caught up. No requests need review.</div>
            )}
            <NavLink to="/leave-requests" className="text-link">
              View all requests <ArrowUpRight size={15} />
            </NavLink>
          </div>
        </Card>

        <Card title="Upcoming time off">
          <div className="dashboard-card-content">
            {upcomingLeave.length ? (
              <div className="upcoming-list">
                {upcomingLeave.map((request) => {
                  const employee = employeeById.get(request.employeeId);
                  return (
                    <div className="upcoming-row" key={request.id}>
                      <div className="date-tile">
                        <span>{new Date(`${request.startDate.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span>
                        <strong>{new Date(`${request.startDate.slice(0, 10)}T12:00:00`).getDate()}</strong>
                      </div>
                      <div className="hire-details">
                        <strong>{employee ? `${employee.firstName} ${employee.lastName}` : request.employeeName ?? 'Unknown employee'}</strong>
                        <span>{request.leaveType} · through {formatDate(request.endDate)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">No upcoming approved time off.</div>
            )}
            <NavLink to="/leave-requests" className="text-link">
              Open leave calendar <ArrowUpRight size={15} />
            </NavLink>
          </div>
        </Card>

        <Card title="Quick actions">
          <div className="dashboard-card-content quick-actions">
            {session.role !== 'employee' ? (
              <NavLink to="/employees?new=1" className="quick-action">
                <span className="quick-action-icon"><UserPlus size={18} /></span>
                <span><strong>Add an employee</strong><small>Create a new employee record</small></span>
                <ArrowUpRight size={16} />
              </NavLink>
            ) : null}
            <NavLink to="/employees" className="quick-action">
              <span className="quick-action-icon"><Users size={18} /></span>
              <span><strong>Employee directory</strong><small>Search the current workforce</small></span>
              <ArrowUpRight size={16} />
            </NavLink>
            <NavLink to="/leave-requests" className="quick-action">
              <span className="quick-action-icon"><CalendarDays size={18} /></span>
              <span><strong>Leave management</strong><small>Review requests and time off</small></span>
              <ArrowUpRight size={16} />
            </NavLink>
            <button type="button" className="quick-action quick-action-button" onClick={exportReport}>
              <span className="quick-action-icon"><Download size={18} /></span>
              <span><strong>Download workforce report</strong><small>Export employees and leave data</small></span>
              <ArrowUpRight size={16} />
            </button>
          </div>
        </Card>
      </div>
      <div className="dashboard-footer">
        <CalendarCheck2 size={15} />
        Workforce data is based on the latest records in your employee system.
      </div>
    </div>
  );
}

function EmployeesPage({ session }: { session: User }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreateEmployees = session.role !== 'employee';
  const canArchiveEmployees = session.role === 'admin' || session.role === 'hr_manager';
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [managerOptions, setManagerOptions] = useState<EmployeeRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [isCreating, setIsCreating] = useState(() => canCreateEmployees && searchParams.get('new') === '1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [managerSearch, setManagerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeRecord['employmentStatus']>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'employeeNumber' | 'jobTitle' | 'status' | 'hireDate'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showArchived, setShowArchived] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState<EmployeeFormState>(() => createDefaultEmployeeForm());

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: '1', pageSize: '100' });
    if (managerSearch.trim()) query.set('search', managerSearch.trim());

    apiFetch<{ employees: EmployeeRecord[] }>(`/employees?${query}`)
      .then((response) => {
        if (active) setManagerOptions(response.employees.filter((employee) => employee.employmentStatus !== 'inactive'));
      })
      .catch((requestError: unknown) => {
        if (active) setLoadError(requestError instanceof Error ? requestError.message : 'Unable to load employee managers.');
      });

    return () => {
      active = false;
    };
  }, [managerSearch]);

  useEffect(() => {
    let active = true;
    const loadEmployees = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({ page: String(page), pageSize: '20' });
        if (debouncedSearch) query.set('search', debouncedSearch);
        if (statusFilter !== 'all') query.set('status', statusFilter);
        if (departmentFilter !== 'all') query.set('departmentId', departmentFilter);
        query.set('sortBy', sortBy);
        query.set('sortOrder', sortOrder);
        if (showArchived) query.set('archived', 'true');
        const [employeeResponse, departmentResponse] = await Promise.all([
          apiFetch<{ employees: EmployeeRecord[]; pagination: Pagination }>(`/employees?${query}`),
          apiFetch<{ departments: DepartmentRecord[] }>('/departments'),
        ]);
        if (!active) return;

        setEmployees(employeeResponse.employees);
        setPagination(employeeResponse.pagination);
        setDepartments(departmentResponse.departments);
        setLoadError('');
        const defaultDepartmentId = departmentResponse.departments[0]?.id;
        if (defaultDepartmentId) {
          setForm((current) => departmentResponse.departments.some((department) => department.id === current.departmentId)
            ? current
            : { ...current, departmentId: defaultDepartmentId });
        }
      } catch (requestError) {
        if (active) setLoadError(requestError instanceof Error ? requestError.message : 'Unable to load employees.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadEmployees();
    return () => {
      active = false;
    };
  }, [page, debouncedSearch, statusFilter, departmentFilter, sortBy, sortOrder, showArchived, refreshKey]);

  const filteredEmployees = employees;

  const departmentLookup = new Map(departments.map((department) => [department.id, department.name]));

  const closeForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormError('');
    setForm(createDefaultEmployeeForm());
    setSearchParams({}, { replace: true });
  };

  const handleSaveEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        ...form,
        managerId: form.managerId || null,
        phone: form.phone.trim() || null,
        departmentId: form.departmentId || null,
        ...(form.employeeNumber.trim() ? { employeeNumber: form.employeeNumber.trim() } : {}),
      };

      await apiFetch<{ employee: EmployeeRecord }>(
        editingId ? `/employees/${editingId}` : '/employees',
        {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );

      setForm(createDefaultEmployeeForm());
      setIsCreating(false);
      setEditingId(null);
      setSearchParams({}, { replace: true });
      setPage(1);
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to save employee.');
    } finally {
      setSubmitting(false);
    }
  };

  const editEmployee = (employee: EmployeeRecord) => {
    setForm({
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      departmentId: employee.departmentId,
      jobTitle: employee.jobTitle,
      managerId: employee.managerId ?? '',
      hireDate: employee.hireDate.slice(0, 10),
      employmentStatus: employee.employmentStatus,
    });
    setEditingId(employee.id);
    setIsCreating(true);
    setFormError('');
    setSelectedEmployee(null);
    setSearchParams({}, { replace: true });
  };

  const archiveEmployee = async (employee: EmployeeRecord) => {
    if (!window.confirm(`Archive ${employee.firstName} ${employee.lastName}? Their record will be retained and can be restored by HR.`)) return;
    setLoadError('');
    try {
      await apiFetch<{ employee: EmployeeRecord }>(`/employees/${employee.id}`, { method: 'DELETE' });
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : 'Unable to archive employee.');
    }
  };

  const restoreEmployee = async (employee: EmployeeRecord) => {
    if (!window.confirm(`Restore ${employee.firstName} ${employee.lastName} as an active employee?`)) return;
    setLoadError('');
    try {
      await apiFetch<{ employee: EmployeeRecord }>(`/employees/${employee.id}/restore`, {
        method: 'POST',
      });
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : 'Unable to restore employee.');
    }
  };

  return (
    <Card title="Employee directory">
      <div className="stack">
        <div className="toolbar-row">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search employees"
            className="input-field"
          />
          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as typeof sortBy);
              setPage(1);
            }}
            className="input-field"
            aria-label="Sort employees by"
          >
            <option value="name">Sort: name</option>
            <option value="employeeNumber">Sort: employee ID</option>
            <option value="jobTitle">Sort: job title</option>
            <option value="status">Sort: status</option>
            <option value="hireDate">Sort: hire date</option>
          </select>
          <select
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value as typeof sortOrder);
              setPage(1);
            }}
            className="input-field"
            aria-label="Sort direction"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          {canArchiveEmployees ? (
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => {
                setShowArchived((current) => !current);
                setPage(1);
              }}
            >
              {showArchived ? 'Show active employees' : 'View archived'}
            </button>
          ) : null}
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as typeof statusFilter);
              setPage(1);
            }}
            className="input-field"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="probation">Probation</option>
            <option value="on_leave">On leave</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={departmentFilter}
            onChange={(event) => {
              setDepartmentFilter(event.target.value);
              setPage(1);
            }}
            className="input-field"
          >
            <option value="all">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          {canCreateEmployees ? (
            <button
              type="button"
              className="primary-button compact"
              onClick={() => {
                if (isCreating) {
                  closeForm();
                } else {
                  setForm(createDefaultEmployeeForm());
                  setEditingId(null);
                  setFormError('');
                  setIsCreating(true);
                  setSearchParams({ new: '1' }, { replace: true });
                }
              }}
            >
              {isCreating ? 'Close form' : 'Add employee'}
            </button>
          ) : null}
        </div>

        {isCreating ? (
          <form onSubmit={handleSaveEmployee} className="form-panel">
            <h4>{editingId ? 'Edit employee record' : 'Add employee'}</h4>
            <div className="form-grid">
              <label>
                First name
                <input
                  required
                  maxLength={80}
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                />
              </label>
              <label>
                Last name
                <input
                  required
                  maxLength={80}
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                />
              </label>
              <label>
                Employee #
                <input
                  placeholder="Generated when left blank"
                  maxLength={32}
                  value={form.employeeNumber}
                  onChange={(event) => setForm((current) => ({ ...current, employeeNumber: event.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
              <label>
                Phone
                <input
                  maxLength={40}
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </label>
              <label>
                Job title
                <input
                  required
                  maxLength={120}
                  value={form.jobTitle}
                  onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))}
                />
              </label>
              <label>
                Department
                <select
                  value={form.departmentId}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    departmentId: event.target.value,
                    managerId: '',
                  }))}
                >
                  <option value="">No department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Line manager
                <input
                  value={managerSearch}
                  onChange={(event) => setManagerSearch(event.target.value)}
                  placeholder="Search managers"
                  aria-label="Search line managers"
                />
                <select
                  value={form.managerId}
                  onChange={(event) => setForm((current) => ({ ...current, managerId: event.target.value }))}
                >
                  <option value="">No line manager</option>
                  {form.managerId && !managerOptions.some((manager) => manager.id === form.managerId) ? (
                    <option value={form.managerId}>Current manager</option>
                  ) : null}
                  {managerOptions
                    .filter((manager) => manager.id !== editingId && manager.departmentId === form.departmentId)
                    .map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.firstName} {manager.lastName} · {manager.jobTitle}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Hire date
                <input
                  type="date"
                  required
                  value={form.hireDate}
                  onChange={(event) => setForm((current) => ({ ...current, hireDate: event.target.value }))}
                />
              </label>
              <label>
                Employment status
                <select
                  value={form.employmentStatus}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, employmentStatus: event.target.value as EmployeeRecord['employmentStatus'] }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="probation">Probation</option>
                  <option value="on_leave">On leave</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <div className="button-row right-align">
              <button
                type="button"
                className="ghost-button compact"
                onClick={closeForm}
              >
                Cancel
              </button>
              <button type="submit" className="primary-button compact" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Save employee'}
              </button>
            </div>
          </form>
        ) : null}

        {loadError ? <div className="error-banner">{loadError}</div> : null}
        {loading ? (
          <div className="muted-copy">Loading employee directory...</div>
        ) : filteredEmployees.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Employee #</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <strong>{employee.firstName} {employee.lastName}</strong>
                      <div className="muted-copy">{employee.email}</div>
                    </td>
                    <td>{employee.employeeNumber}</td>
                    <td>{departmentLookup.get(employee.departmentId) ?? 'Unassigned'}</td>
                    <td>
                      <span className={`status-pill ${employee.employmentStatus}`}>{employee.employmentStatus.replace('_', ' ')}</span>
                      {employee.isArchived ? <span className="status-pill archived">Archived</span> : null}
                    </td>
                    <td>
                      <div className="employee-actions">
                        <button
                          type="button"
                          className="ghost-button compact"
                          onClick={() => setSelectedEmployee(employee)}
                        >
                          View
                        </button>
                        {!showArchived && canCreateEmployees ? (
                          <button
                            type="button"
                            className="ghost-button compact"
                            onClick={() => editEmployee(employee)}
                          >
                            Edit
                          </button>
                        ) : null}
                        {canArchiveEmployees ? (
                          showArchived ? (
                            <button
                              type="button"
                              className="ghost-button compact success"
                              onClick={() => void restoreEmployee(employee)}
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ghost-button compact danger"
                              onClick={() => void archiveEmployee(employee)}
                            >
                              Archive
                            </button>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            {showArchived ? 'No archived employees were found.' : 'No employees match the current filters.'}
          </div>
        )}
        {selectedEmployee ? (
          <div className="dialog-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedEmployee(null);
          }}>
            <section
              className="employee-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="employee-dialog-title"
            >
              <div className="row-between">
                <div>
                  <div className="eyebrow">Employee profile</div>
                  <h3 id="employee-dialog-title">{selectedEmployee.firstName} {selectedEmployee.lastName}</h3>
                </div>
                <button
                  type="button"
                  className="ghost-button compact"
                  onClick={() => setSelectedEmployee(null)}
                  aria-label="Close employee details"
                >
                  <X size={18} />
                </button>
              </div>
              <dl className="employee-details">
                <div><dt>Employee number</dt><dd>{selectedEmployee.employeeNumber}</dd></div>
                <div><dt>Work email</dt><dd>{selectedEmployee.email}</dd></div>
                <div><dt>Phone</dt><dd>{selectedEmployee.phone || 'Not provided'}</dd></div>
                <div><dt>Job title</dt><dd>{selectedEmployee.jobTitle}</dd></div>
                <div><dt>Department</dt><dd>{departmentLookup.get(selectedEmployee.departmentId) ?? 'Unassigned'}</dd></div>
                <div><dt>Hire date</dt><dd>{formatDate(selectedEmployee.hireDate)}</dd></div>
                <div><dt>Status</dt><dd>{selectedEmployee.employmentStatus.replace('_', ' ')}</dd></div>
              </dl>
            </section>
          </div>
        ) : null}
        {pagination.totalPages > 1 ? (
          <div className="button-row right-align">
            <span className="muted-copy">
              Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </span>
            <button type="button" className="ghost-button compact" onClick={() => setPage((current) => current - 1)} disabled={page <= 1}>
              Previous
            </button>
            <span className="muted-copy">Page {page} of {pagination.totalPages}</span>
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= pagination.totalPages}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function DepartmentsPage({ session }: { session: User }) {
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', managerId: '' });
  const canManageDepartments = session.role === 'admin' || session.role === 'hr_manager';

  useEffect(() => {
    let active = true;
    const loadDepartments = async () => {
      try {
        const [departmentResponse, employeeResponse] = await Promise.all([
          apiFetch<{ departments: DepartmentRecord[] }>('/departments'),
          canManageDepartments
            ? apiFetch<{ employees: EmployeeRecord[] }>('/employees')
            : Promise.resolve({ employees: [] }),
        ]);
        if (!active) return;
        setDepartments(departmentResponse.departments);
        setEmployees(employeeResponse.employees);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load departments.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDepartments();
    return () => {
      active = false;
    };
  }, [canManageDepartments]);

  const saveDepartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const path = editingId ? `/departments/${editingId}` : '/departments';
      const result = await apiFetch<{ department: DepartmentRecord }>(path, {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          managerId: form.managerId || null,
        }),
      });

      setDepartments((current) =>
        editingId
          ? current.map((department) => department.id === editingId ? result.department : department)
          : [...current, result.department].sort((first, second) => first.name.localeCompare(second.name)),
      );
      setEditingId(null);
      setForm({ name: '', description: '', managerId: '' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save department.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Departments">
      <div className="stack">
        {error ? <div className="error-banner">{error}</div> : null}
        {canManageDepartments ? (
          <form onSubmit={saveDepartment} className="form-panel">
            <div className="form-grid">
              <label>
                Department name
                <input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Manager
                <select
                  value={form.managerId}
                  onChange={(event) => setForm((current) => ({ ...current, managerId: event.target.value }))}
                >
                  <option value="">No manager assigned</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-wide">
                Description
                <input
                  maxLength={500}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
            </div>
            <div className="button-row right-align">
              {editingId ? (
                <button
                  type="button"
                  className="ghost-button compact"
                  onClick={() => {
                    setEditingId(null);
                    setForm({ name: '', description: '', managerId: '' });
                  }}
                >
                  Cancel edit
                </button>
              ) : null}
              <button type="submit" className="primary-button compact" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Add department'}
              </button>
            </div>
          </form>
        ) : null}
        {loading ? <div className="muted-copy">Loading departments...</div> : departments.length ? (
          <div className="card-list">
            {departments.map((department) => (
              <div key={department.id} className="mini-card">
                <div className="row-between">
                  <strong>{department.name}</strong>
                  {canManageDepartments ? (
                    <button
                      type="button"
                      className="ghost-button compact"
                      onClick={() => {
                        setEditingId(department.id);
                        setForm({
                          name: department.name,
                          description: department.description,
                          managerId: department.managerId ?? '',
                        });
                      }}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
                <span>{department.description || 'No description provided.'}</span>
                <small className="muted-copy">{department.employeeCount ?? 0} employees</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No departments have been created yet.</div>
        )}
      </div>
    </Card>
  );
}

function LeavePage({ session }: { session: User }) {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingLeaveId, setUpdatingLeaveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveRequestRecord['status']>('all');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    let active = true;
    const loadLeaveRequests = async () => {
      try {
        const query = new URLSearchParams({ page: String(page), pageSize: '20' });
        if (search.trim()) query.set('search', search.trim());
        if (statusFilter !== 'all') query.set('status', statusFilter);
        const leaveResponse = await apiFetch<{ leaveRequests: LeaveRequestRecord[]; leaveTypes: LeaveTypeRecord[]; pagination: Pagination }>(`/leave-requests?${query}`);

        if (!active) return;
        setLeaveRequests(leaveResponse.leaveRequests);
        setLeaveTypes(leaveResponse.leaveTypes);
        setPagination(leaveResponse.pagination);
        setForm((current) => ({
          ...current,
          leaveType: current.leaveType && leaveResponse.leaveTypes.some((type) => type.name === current.leaveType)
            ? current.leaveType
            : leaveResponse.leaveTypes[0]?.name ?? '',
        }));
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load leave requests.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadLeaveRequests();
    return () => {
      active = false;
    };
  }, [page, search, statusFilter]);

  useEffect(() => {
    let active = true;
    const loadEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const query = new URLSearchParams({ page: '1', pageSize: '100' });
        if (employeeSearch.trim()) query.set('search', employeeSearch.trim());
        const response = await apiFetch<{ employees: EmployeeRecord[] }>(`/employees?${query}`);
        if (!active) return;
        setEmployees(response.employees);
        if (session.role === 'employee') setEmployeeId(response.employees[0]?.id ?? '');
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load employee options.');
      } finally {
        if (active) setLoadingEmployees(false);
      }
    };

    void loadEmployees();
    return () => {
      active = false;
    };
  }, [employeeSearch, session.role]);

  const employeeLookup = new Map(employees.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`]));

  const filteredLeaveRequests = leaveRequests;

  const updateLeaveStatus = async (id: string, status: LeaveRequestRecord['status']) => {
    setError('');
    setUpdatingLeaveId(id);
    try {
      const result = await apiFetch<{ leaveRequest: LeaveRequestRecord }>(`/leave-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      setLeaveRequests((current) => current.map((item) => (item.id === id ? result.leaveRequest : item)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update this leave request.');
    } finally {
      setUpdatingLeaveId(null);
    }
  };

  const canReviewLeave = session.role === 'admin' || session.role === 'hr_manager' || session.role === 'department_manager';
  const canApplyLeave = true;
  const requiresEmployeeSelection = session.role !== 'employee';

  const submitLeaveRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const result = await apiFetch<{ leaveRequest: LeaveRequestRecord }>('/leave-requests', {
        method: 'POST',
        body: JSON.stringify({
          ...(requiresEmployeeSelection ? { employeeId } : {}),
          leaveType: form.leaveType,
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason,
        }),
      });
      setLeaveRequests((current) => [result.leaveRequest, ...current]);
      setForm((current) => ({ ...current, reason: '' }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit your leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Leave requests">
      <div className="stack">
        {error ? <div className="error-banner">{error}</div> : null}
        {canApplyLeave ? (
          <form onSubmit={submitLeaveRequest} className="form-panel">
            <h4>Request time off</h4>
            <div className="form-grid">
              {requiresEmployeeSelection ? (
                <>
                  <label>
                    Find employee
                    <input
                      type="search"
                      value={employeeSearch}
                      onChange={(event) => setEmployeeSearch(event.target.value)}
                      placeholder="Search by name, email or employee number"
                    />
                  </label>
                  <label>
                    Employee
                    <select
                      required
                      value={employeeId}
                      onChange={(event) => setEmployeeId(event.target.value)}
                      disabled={loadingEmployees}
                    >
                      <option value="">Select an employee</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName} · {employee.employeeNumber}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <label>
                Leave type
                <select
                  required
                  value={form.leaveType}
                  onChange={(event) => setForm((current) => ({ ...current, leaveType: event.target.value }))}
                >
                  {leaveTypes.map((leaveType) => (
                    <option key={leaveType.id} value={leaveType.name}>{leaveType.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Start date
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  required
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                />
              </label>
              <label className="form-wide">
                Reason
                <input
                  maxLength={1000}
                  value={form.reason}
                  onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                />
              </label>
            </div>
            <div className="button-row right-align">
              <button
                type="submit"
                className="primary-button compact"
                disabled={submitting || loading || loadingEmployees || !leaveTypes.length || (requiresEmployeeSelection && !employeeId)}
              >
                {submitting ? 'Submitting...' : 'Submit request'}
              </button>
            </div>
            {!loadingEmployees && !employees.length ? (
              <div className="muted-copy">
                {requiresEmployeeSelection ? 'No employees match this search.' : 'Your account is not linked to an employee profile.'}
              </div>
            ) : null}
          </form>
        ) : null}
        <div className="toolbar-row single-line">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search leave requests"
            className="input-field"
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as typeof statusFilter);
              setPage(1);
            }}
            className="input-field"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? <div className="muted-copy">Loading leave requests...</div> : filteredLeaveRequests.length ? (
          <div className="card-list">
            {filteredLeaveRequests.map((item) => (
              <div key={item.id} className="mini-card">
                <div className="row-between">
                  <strong>{item.employeeName ?? employeeLookup.get(item.employeeId) ?? 'Unknown employee'}</strong>
                  <span className={`status-pill ${item.status}`}>{item.status}</span>
                </div>
                <div className="row-between muted-copy">
                  <span>{item.leaveType}</span>
                  <span>
                    {formatDate(item.startDate)} → {formatDate(item.endDate)}
                  </span>
                </div>
                <small>{item.reason}</small>
                {canReviewLeave && item.status === 'pending' ? (
                  <div className="button-row">
                    <button type="button" className="ghost-button compact success" onClick={() => void updateLeaveStatus(item.id, 'approved')} disabled={updatingLeaveId === item.id}>
                      Approve
                    </button>
                    <button type="button" className="ghost-button compact danger" onClick={() => void updateLeaveStatus(item.id, 'rejected')} disabled={updatingLeaveId === item.id}>
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No leave requests match the current filters.</div>
        )}
        {pagination.totalPages > 1 ? (
          <div className="button-row right-align">
            <span className="muted-copy">
              Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </span>
            <button type="button" className="ghost-button compact" onClick={() => setPage((current) => current - 1)} disabled={page <= 1}>
              Previous
            </button>
            <span className="muted-copy">Page {page} of {pagination.totalPages}</span>
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= pagination.totalPages}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
  tone,
  to,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'amber' | 'violet';
  to?: string;
}) {
  const content = (
    <>
      <div className="stat-card-top">
        <div className="eyebrow">{label}</div>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </>
  );

  return to ? (
    <NavLink to={to} className={`stat-card dashboard-stat ${tone} stat-card-link`} aria-label={`${label}: ${value}. ${detail}`}>
      {content}
    </NavLink>
  ) : (
    <div className={`stat-card dashboard-stat ${tone}`}>{content}</div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function createDefaultEmployeeForm(): EmployeeFormState {
  return {
    employeeNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '+1-555-0100',
    departmentId: 'dept-1',
    jobTitle: 'Operations Specialist',
    managerId: '',
    hireDate: new Date().toISOString().slice(0, 10),
    employmentStatus: 'active',
  };
}

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatLongDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export default App;
