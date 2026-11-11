import { randomBytes } from 'node:crypto';
import type { EmploymentStatus, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, getRouteParam } from '../lib/apiError.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize, type AuthUser } from '../middleware/auth.js';

const router = Router();
const employmentStatuses = ['active', 'probation', 'on_leave', 'inactive'] as const;
const employeeInputSchema = z.object({
  employeeNumber: z.string().trim().min(1).max(32).optional(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).nullable().optional(),
  departmentId: z.string().min(1).nullable().optional(),
  jobTitle: z.string().trim().min(1).max(120),
  managerId: z.string().min(1).nullable().optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employmentStatus: z.enum(employmentStatuses).default('active'),
}).strict();
const employeeUpdateSchema = employeeInputSchema.partial().strict();

function toEmployeeRecord(employee: {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  departmentId: string | null;
  jobTitle: string;
  managerId: string | null;
  hireDate: Date;
  employmentStatus: EmploymentStatus;
  isArchived: boolean;
}) {
  return {
    ...employee,
    phone: employee.phone ?? '',
    departmentId: employee.departmentId ?? '',
    hireDate: employee.hireDate.toISOString().slice(0, 10),
    employmentStatus: employee.employmentStatus.toLowerCase(),
  };
}

function toDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError('Hire date must be a valid calendar date.', 400);
  }
  return date;
}

async function getManagerDepartment(user: AuthUser) {
  return prisma.employee.findUnique({
    where: { email: user.email },
    select: { departmentId: true },
  });
}

async function canManageEmployee(user: AuthUser, employee: { id: string; departmentId: string | null }) {
  if (user.role === 'admin' || user.role === 'hr_manager') return true;

  const manager = await prisma.employee.findUnique({
    where: { email: user.email },
    select: { id: true, departmentId: true },
  });

  if (user.role === 'employee') return manager?.id === employee.id;
  return Boolean(manager?.departmentId && manager.departmentId === employee.departmentId);
}

router.get('/', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 100));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const where: Prisma.EmployeeWhereInput = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { email: { contains: search } },
      { employeeNumber: { contains: search } },
      { jobTitle: { contains: search } },
    ];
  }

  if (typeof req.query.status === 'string' && req.query.status !== 'all') {
    const status = z.enum(employmentStatuses).safeParse(req.query.status);
    if (!status.success) throw new ApiError('Invalid employment status filter.', 400);
    where.employmentStatus = status.data.toUpperCase() as EmploymentStatus;
  }

  if (typeof req.query.departmentId === 'string' && req.query.departmentId !== 'all') {
    where.departmentId = req.query.departmentId;
  }

  if (req.user?.role === 'employee') {
    where.email = req.user.email;
  } else if (req.user?.role === 'department_manager') {
    const manager = await getManagerDepartment(req.user);
    where.departmentId = manager?.departmentId ?? '__no_department__';
  }

  const [employees, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  return res.json({
    employees: employees.map(toEmployeeRecord),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

router.get('/:id', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), async (req, res) => {
  const id = getRouteParam(req, 'id');
  const employee = await prisma.employee.findUnique({ where: { id } });

  if (!employee || !(await canManageEmployee(req.user!, employee))) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  return res.json({ employee: toEmployeeRecord(employee) });
});

router.post('/', authenticate, authorize(['admin', 'hr_manager', 'department_manager']), async (req, res) => {
  const parsed = employeeInputSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;

  const user = req.user!;
  const input = parsed.data;
  if (user.role === 'department_manager') {
    const manager = await getManagerDepartment(user);
    if (!manager?.departmentId || input.departmentId !== manager.departmentId) {
      throw new ApiError('Department managers may only add employees to their own department.', 403);
    }
  }

  const departmentId = input.departmentId ?? null;
  const managerId = input.managerId ?? null;
  const employeeNumber = input.employeeNumber
    ?? `EMP-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
  const created = await prisma.$transaction(async (transaction) => {
    const employee = await transaction.employee.create({
      data: {
        employeeNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        phone: input.phone ?? null,
        departmentId,
        jobTitle: input.jobTitle,
        managerId,
        hireDate: toDate(input.hireDate),
        employmentStatus: input.employmentStatus.toUpperCase() as EmploymentStatus,
      },
    });

    await transaction.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'EMPLOYEE_CREATED',
        entityType: 'employee',
        entityId: employee.id,
      },
    });
    return employee;
  });

  return res.status(201).json({ employee: toEmployeeRecord(created) });
});

router.patch('/:id', authenticate, authorize(['admin', 'hr_manager', 'department_manager']), async (req, res) => {
  const parsed = employeeUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  if (Object.keys(parsed.data).length === 0) throw new ApiError('At least one employee field is required.', 400);

  const user = req.user!;
  const id = getRouteParam(req, 'id');
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing || !(await canManageEmployee(user, existing))) {
    return res.status(404).json({ message: 'Employee not found.' });
  }
  if (user.role === 'department_manager' && parsed.data.departmentId !== undefined
    && parsed.data.departmentId !== existing.departmentId) {
    throw new ApiError('Department managers cannot move employees between departments.', 403);
  }

  const input = parsed.data;
  const data: Prisma.EmployeeUpdateInput = {};
  if (input.employeeNumber !== undefined) data.employeeNumber = input.employeeNumber;
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.email !== undefined) data.email = input.email.toLowerCase();
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.departmentId !== undefined) {
    data.department = input.departmentId ? { connect: { id: input.departmentId } } : { disconnect: true };
  }
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle;
  if (input.managerId !== undefined) {
    data.manager = input.managerId ? { connect: { id: input.managerId } } : { disconnect: true };
  }
  if (input.hireDate !== undefined) data.hireDate = toDate(input.hireDate);
  if (input.employmentStatus !== undefined) {
    data.employmentStatus = input.employmentStatus.toUpperCase() as EmploymentStatus;
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const employee = await transaction.employee.update({ where: { id: existing.id }, data });
    await transaction.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'EMPLOYEE_UPDATED',
        entityType: 'employee',
        entityId: employee.id,
      },
    });
    return employee;
  });

  return res.json({ employee: toEmployeeRecord(updated) });
});

router.delete('/:id', authenticate, authorize(['admin', 'hr_manager']), async (req, res) => {
  const id = getRouteParam(req, 'id');
  const employee = await prisma.$transaction(async (transaction) => {
    const archived = await transaction.employee.update({
      where: { id },
      data: { isArchived: true, employmentStatus: 'INACTIVE' },
    });
    await transaction.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: 'EMPLOYEE_ARCHIVED',
        entityType: 'employee',
        entityId: archived.id,
      },
    });
    return archived;
  });

  return res.json({ employee: toEmployeeRecord(employee), message: 'Employee archived successfully.' });
});

export default router;
