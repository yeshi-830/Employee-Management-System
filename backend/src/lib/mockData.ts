import bcrypt from 'bcryptjs';

export type Role = 'admin' | 'hr_manager' | 'department_manager' | 'employee';
export type EmploymentStatus = 'active' | 'probation' | 'on_leave' | 'inactive';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  managerId: string | null;
}

export interface Employee {
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
  employmentStatus: EmploymentStatus;
  isArchived: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
}

export const users: User[] = [
  {
    id: 'u-1',
    email: 'hr@northstar.example',
    password: bcrypt.hashSync('Password123!', 10),
    name: 'Ari Green',
    role: 'hr_manager',
  },
  {
    id: 'u-2',
    email: 'manager@northstar.example',
    password: bcrypt.hashSync('Password123!', 10),
    name: 'Nia Cooper',
    role: 'department_manager',
  },
  {
    id: 'u-3',
    email: 'employee@northstar.example',
    password: bcrypt.hashSync('Password123!', 10),
    name: 'Leo Hart',
    role: 'employee',
  },
];

export const departments: Department[] = [
  { id: 'dept-1', name: 'Engineering', description: 'Product and platform engineering', managerId: 'emp-1' },
  { id: 'dept-2', name: 'People Ops', description: 'Employee lifecycle and HR operations', managerId: null },
  { id: 'dept-3', name: 'Finance', description: 'Budget and payroll operations', managerId: 'emp-3' },
];

export const employees: Employee[] = [
  {
    id: 'emp-1',
    employeeNumber: 'EMP-101',
    firstName: 'Nia',
    lastName: 'Cooper',
    email: 'nia.cooper@northstar.example',
    phone: '+1-555-0101',
    departmentId: 'dept-1',
    jobTitle: 'Engineering Manager',
    managerId: null,
    hireDate: '2021-04-10',
    employmentStatus: 'active',
    isArchived: false,
  },
  {
    id: 'emp-2',
    employeeNumber: 'EMP-102',
    firstName: 'Leo',
    lastName: 'Hart',
    email: 'leo.hart@northstar.example',
    phone: '+1-555-0102',
    departmentId: 'dept-1',
    jobTitle: 'Frontend Engineer',
    managerId: 'emp-1',
    hireDate: '2023-10-04',
    employmentStatus: 'active',
    isArchived: false,
  },
  {
    id: 'emp-3',
    employeeNumber: 'EMP-103',
    firstName: 'Mila',
    lastName: 'Reed',
    email: 'mila.reed@northstar.example',
    phone: '+1-555-0103',
    departmentId: 'dept-2',
    jobTitle: 'HR Specialist',
    managerId: null,
    hireDate: '2022-08-15',
    employmentStatus: 'probation',
    isArchived: false,
  },
  {
    id: 'emp-4',
    employeeNumber: 'EMP-104',
    firstName: 'Ethan',
    lastName: 'Parker',
    email: 'ethan.parker@northstar.example',
    phone: '+1-555-0104',
    departmentId: 'dept-3',
    jobTitle: 'Senior Analyst',
    managerId: null,
    hireDate: '2020-02-18',
    employmentStatus: 'on_leave',
    isArchived: false,
  },
];

export const leaveRequests: LeaveRequest[] = [
  {
    id: 'leave-1',
    employeeId: 'emp-1',
    leaveType: 'Annual Leave',
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    reason: 'Family vacation',
    status: 'pending',
  },
  {
    id: 'leave-2',
    employeeId: 'emp-3',
    leaveType: 'Sick Leave',
    startDate: '2026-11-07',
    endDate: '2026-11-08',
    reason: 'Medical appointment',
    status: 'approved',
  },
];

export function sanitizeUser(user: User) {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function getDashboardSummary() {
  const totalEmployees = employees.filter((employee) => !employee.isArchived).length;
  const activeEmployees = employees.filter((employee) => !employee.isArchived && employee.employmentStatus === 'active').length;
  const pendingLeave = leaveRequests.filter((leaveRequest) => leaveRequest.status === 'pending').length;

  return {
    totalEmployees,
    activeEmployees,
    employeesByDepartment: departments.map((department) => ({
      name: department.name,
      total: employees.filter((employee) => employee.departmentId === department.id && !employee.isArchived).length,
    })),
    recentHires: employees
      .filter((employee) => !employee.isArchived)
      .sort((a, b) => new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime())
      .slice(0, 3),
    pendingLeave,
  };
}
