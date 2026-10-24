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
              <div key={item.name} className="metric-row">
                <span>{item.name}</span>
                <strong>{item.total}</strong>
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

  useEffect(() => {
    const loadEmployees = async () => {
      const response = await apiFetch<{ employees: EmployeeRecord[] }>('/employees');
      setEmployees(response.employees);
    };

    void loadEmployees();
  }, []);

  return (
    <Card title="Employee directory">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Employee #</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>
                {employee.firstName} {employee.lastName}
              </td>
              <td>{employee.employeeNumber}</td>
              <td>{employee.jobTitle}</td>
              <td>{employee.employmentStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

  useEffect(() => {
    const loadLeaveRequests = async () => {
      const response = await apiFetch<{ leaveRequests: LeaveRequestRecord[] }>('/leave-requests');
      setLeaveRequests(response.leaveRequests);
    };

    void loadLeaveRequests();
  }, []);

  return (
    <Card title="Leave requests">
      <div className="card-list">
        {leaveRequests.map((item) => (
          <div key={item.id} className="mini-card">
            <div className="row-between">
              <strong>{item.leaveType}</strong>
              <span className="status-pill">{item.status}</span>
            </div>
            <span>
              {item.startDate} → {item.endDate}
            </span>
            <small>{item.reason}</small>
          </div>
        ))}
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

export default App;
