import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  Activity,
  Building2,
  CalendarCheck2,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
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
};

type LeaveRequestRecord = {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
};

type DashboardSummary = {
  totalEmployees: number;
  activeEmployees: number;
  pendingLeave: number;
  employeesByDepartment: Array<{ name: string; total: number }>;
  recentHires: EmployeeRecord[];
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
    const storedUser = localStorage.getItem('ems_user');
    if (storedUser) {
      setSession(JSON.parse(storedUser) as User);
    }

    void checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    try {
      const result = await apiFetch<{ user: User }>('/auth/me');
      setSession(result.user);
      localStorage.setItem('ems_user', JSON.stringify(result.user));
    } catch {
      setSession(null);
      localStorage.removeItem('ems_user');
    } finally {
      setLoadingUser(false);
    }
  };

  const login = async (email: string, password: string) => {
    const result = await apiFetch<{ user: User; csrfToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setSession(result.user);
    localStorage.setItem('ems_user', JSON.stringify(result.user));
    localStorage.setItem('ems_csrf_token', result.csrfToken);
    return result.user;
  };

  const logout = async () => {
    await apiFetch<{ message: string }>('/auth/logout', { method: 'POST' });
    setSession(null);
    localStorage.removeItem('ems_user');
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
  const [email, setEmail] = useState('hr@northstar.example');
  const [password, setPassword] = useState('Password123!');
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
            <div className="eyebrow">Northstar Labs</div>
            <h1>Employee Management System</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Work email
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>

          {error ? <div className="error-banner">{error}</div> : null}
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="demo-box">
          <ShieldCheck size={18} />
          <span>Demo credentials: hr@northstar.example / Password123!</span>
        </div>
      </div>
    </div>
  );
}

function AuthenticatedShell({ session, logout }: { session: User; logout: () => Promise<void> }) {
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/employees', label: 'Employees', icon: Users },
    { to: '/departments', label: 'Departments', icon: Building2 },
    { to: '/leave-requests', label: 'Leave requests', icon: CalendarCheck2 },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-row sidebar-brand">
          <div className="brand-mark">N</div>
          <div>
            <div className="eyebrow">Northstar Labs</div>
            <strong>EMS</strong>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="user-panel">
          <div>
            <div className="user-name">{session.name}</div>
            <div className="user-role">{session.role.replace('_', ' ')}</div>
          </div>
          <button type="button" className="ghost-button" onClick={() => void logout()}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      <main className="content-panel">
        <header className="topbar">
          <div>
            <div className="eyebrow">Operations</div>
            <h2>Employee workspace</h2>
          </div>
          <div className="topbar-badge">
            <Activity size={16} />
            Protected
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/leave-requests" element={<LeavePage />} />
        </Routes>
      </main>
    </div>
  );
}

function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const result = await apiFetch<DashboardSummary>('/dashboard/summary');
        setSummary(result);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboard();
  }, []);

  if (loading) return <Card title="Loading dashboard">Preparing analytics...</Card>;
  if (!summary) return <Card title="No data">Unable to load dashboard summary.</Card>;

  const maxDepartmentSize = Math.max(...summary.employeesByDepartment.map((item) => item.total), 1);

  return (
    <div className="stack">
      <div className="stats-grid">
        <StatCard label="Total employees" value={String(summary.totalEmployees)} />
        <StatCard label="Active employees" value={String(summary.activeEmployees)} />
        <StatCard label="Pending leave" value={String(summary.pendingLeave)} />
        <StatCard label="Departments" value={String(summary.employeesByDepartment.length)} />
      </div>

      <div className="panel-grid">
        <Card title="Department distribution">
          <div className="metric-list">
            {summary.employeesByDepartment.map((item) => (
              <div key={item.name} className="metric-group">
                <div className="metric-row">
                  <span>{item.name}</span>
                  <strong>{item.total}</strong>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${(item.total / maxDepartmentSize) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent hires">
          <ul className="list">
            {summary.recentHires.length ? (
              summary.recentHires.map((hire) => (
                <li key={hire.id}>
                  {hire.firstName} {hire.lastName} · {hire.jobTitle}
                </li>
              ))
            ) : (
              <li>No recent hires recorded.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeRecord['employmentStatus']>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(() => createDefaultEmployeeForm());

  const loadEmployees = async () => {
    try {
      const [employeeResponse, departmentResponse] = await Promise.all([
        apiFetch<{ employees: EmployeeRecord[] }>('/employees'),
        apiFetch<{ departments: DepartmentRecord[] }>('/departments'),
      ]);

      setEmployees(employeeResponse.employees);
      setDepartments(departmentResponse.departments);
      if (departmentResponse.departments[0]) {
        setForm((current) => ({ ...current, departmentId: departmentResponse.departments[0].id }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEmployees();
  }, []);

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = `${employee.firstName} ${employee.lastName} ${employee.email}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || employee.employmentStatus === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || employee.departmentId === departmentFilter;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const departmentLookup = new Map(departments.map((department) => [department.id, department.name]));

  const handleCreateEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        ...form,
        managerId: form.managerId || null,
        phone: form.phone || '+1-555-0100',
        departmentId: form.departmentId || departments[0]?.id || 'dept-1',
        employeeNumber: form.employeeNumber || `EMP-${Date.now()}`,
      };

      const result = await apiFetch<{ employee: EmployeeRecord }>('/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setEmployees((current) => [result.employee, ...current]);
      setForm(createDefaultEmployeeForm());
      setIsCreating(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create employee.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Employee directory">
      <div className="stack">
        <div className="toolbar-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employees"
            className="input-field"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="input-field">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="probation">Probation</option>
            <option value="on_leave">On leave</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="input-field">
            <option value="all">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <button type="button" className="primary-button compact" onClick={() => setIsCreating((current) => !current)}>
            {isCreating ? 'Close form' : 'Add employee'}
          </button>
        </div>

        {isCreating ? (
          <form onSubmit={handleCreateEmployee} className="form-panel">
            <div className="form-grid">
              <label>
                First name
                <input
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                />
              </label>
              <label>
                Last name
                <input
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                />
              </label>
              <label>
                Employee #
                <input
                  value={form.employeeNumber}
                  onChange={(event) => setForm((current) => ({ ...current, employeeNumber: event.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </label>
              <label>
                Job title
                <input
                  value={form.jobTitle}
                  onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))}
                />
              </label>
              <label>
                Department
                <select
                  value={form.departmentId}
                  onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}
                >
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Hire date
                <input
                  type="date"
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
              <button type="button" className="ghost-button compact" onClick={() => setIsCreating(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-button compact" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save employee'}
              </button>
            </div>
          </form>
        ) : null}

        {loading ? (
          <div className="muted-copy">Loading employee directory...</div>
        ) : filteredEmployees.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Employee #</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    {employee.firstName} {employee.lastName}
                    <div className="muted-copy">{employee.email}</div>
                  </td>
                  <td>{employee.employeeNumber}</td>
                  <td>{departmentLookup.get(employee.departmentId) ?? 'Unassigned'}</td>
                  <td>
                    <span className={`status-pill ${employee.employmentStatus}`}>{employee.employmentStatus.replace('_', ' ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">No employees match the current filters.</div>
        )}
      </div>
    </Card>
  );
}

function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);

  useEffect(() => {
    const loadDepartments = async () => {
      const response = await apiFetch<{ departments: DepartmentRecord[] }>('/departments');
      setDepartments(response.departments);
    };

    void loadDepartments();
  }, []);

  return (
    <Card title="Departments">
      <div className="card-list">
        {departments.map((department) => (
          <div key={department.id} className="mini-card">
            <strong>{department.name}</strong>
            <span>{department.description}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LeavePage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveRequestRecord['status']>('all');

  useEffect(() => {
    const loadLeaveRequests = async () => {
      const [leaveResponse, employeeResponse] = await Promise.all([
        apiFetch<{ leaveRequests: LeaveRequestRecord[] }>('/leave-requests'),
        apiFetch<{ employees: EmployeeRecord[] }>('/employees'),
      ]);

      setLeaveRequests(leaveResponse.leaveRequests);
      setEmployees(employeeResponse.employees);
    };

    void loadLeaveRequests();
  }, []);

  const employeeLookup = new Map(employees.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`]));

  const filteredLeaveRequests = leaveRequests.filter((leaveRequest) => {
    const employeeName = employeeLookup.get(leaveRequest.employeeId) ?? 'Unknown employee';
    const matchesSearch = `${employeeName} ${leaveRequest.leaveType} ${leaveRequest.reason}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || leaveRequest.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const updateLeaveStatus = async (id: string, status: LeaveRequestRecord['status']) => {
    const result = await apiFetch<{ leaveRequest: LeaveRequestRecord }>(`/leave-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });

    setLeaveRequests((current) => current.map((item) => (item.id === id ? result.leaveRequest : item)));
  };

  return (
    <Card title="Leave requests">
      <div className="stack">
        <div className="toolbar-row single-line">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search leave requests"
            className="input-field"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="input-field">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {filteredLeaveRequests.length ? (
          <div className="card-list">
            {filteredLeaveRequests.map((item) => (
              <div key={item.id} className="mini-card">
                <div className="row-between">
                  <strong>{employeeLookup.get(item.employeeId) ?? 'Unknown employee'}</strong>
                  <span className={`status-pill ${item.status}`}>{item.status}</span>
                </div>
                <div className="row-between muted-copy">
                  <span>{item.leaveType}</span>
                  <span>
                    {formatDate(item.startDate)} → {formatDate(item.endDate)}
                  </span>
                </div>
                <small>{item.reason}</small>
                {item.status === 'pending' ? (
                  <div className="button-row">
                    <button type="button" className="ghost-button compact success" onClick={() => void updateLeaveStatus(item.id, 'approved')}>
                      Approve
                    </button>
                    <button type="button" className="ghost-button compact danger" onClick={() => void updateLeaveStatus(item.id, 'rejected')}>
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
      </div>
    </Card>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="eyebrow">{label}</div>
      <strong>{value}</strong>
    </div>
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
    employeeNumber: 'EMP-200',
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
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default App;
