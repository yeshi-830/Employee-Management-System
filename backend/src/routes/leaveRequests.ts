import type { LeaveStatus, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, getRouteParam } from '../lib/apiError.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
const leaveStatuses = ['pending', 'approved', 'rejected'] as const;
const leaveRequestSchema = z.object({
  employeeId: z.string().min(1).optional(),
  leaveType: z.string().trim().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(1000).nullable().optional(),
}).strict();

function toDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError('Leave dates must be valid calendar dates.', 400);
  }
  return date;
}

function toLeaveRequestRecord(request: {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  reason: string | null;
  status: LeaveStatus;
  leaveType: { name: string };
}) {
  return {
    id: request.id,
    employeeId: request.employeeId,
    leaveType: request.leaveType.name,
    startDate: request.startDate.toISOString().slice(0, 10),
    endDate: request.endDate.toISOString().slice(0, 10),
    reason: request.reason ?? '',
    status: request.status.toLowerCase(),
  };
}

router.get('/', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 100));
  const where: Prisma.LeaveRequestWhereInput = {};

  if (typeof req.query.status === 'string' && req.query.status !== 'all') {
    const status = z.enum(leaveStatuses).safeParse(req.query.status);
    if (!status.success) throw new ApiError('Invalid leave status filter.', 400);
    where.status = status.data.toUpperCase() as LeaveStatus;
  }

  if (req.user?.role === 'employee') {
    const employee = await prisma.employee.findUnique({
      where: { email: req.user.email },
      select: { id: true },
    });
    where.employeeId = employee?.id ?? '__no_employee__';
  } else if (req.user?.role === 'department_manager') {
    const manager = await prisma.employee.findUnique({
      where: { email: req.user.email },
      select: { departmentId: true },
    });
    where.employee = { is: { departmentId: manager?.departmentId ?? '__no_department__' } };
  }

  const [leaveRequests, total] = await prisma.$transaction([
    prisma.leaveRequest.findMany({
      where,
      include: { leaveType: { select: { name: true } } },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return res.json({
    leaveRequests: leaveRequests.map(toLeaveRequestRecord),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

router.post('/', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), async (req, res) => {
  const parsed = leaveRequestSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;

  const input = parsed.data;
  const startDate = toDate(input.startDate);
  const endDate = toDate(input.endDate);
  if (endDate < startDate) throw new ApiError('End date must be on or after the start date.', 400);

  let employeeId = input.employeeId;
  if (req.user?.role === 'employee') {
    const employee = await prisma.employee.findUnique({
      where: { email: req.user.email },
      select: { id: true },
    });
    if (!employee) throw new ApiError('Your employee profile is not linked to this account.', 403);
    employeeId = employee.id;
  }
  if (!employeeId) throw new ApiError('An employee is required for this leave request.', 400);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, departmentId: true },
  });
  if (!employee) throw new ApiError('Employee not found.', 404);
  if (req.user?.role === 'department_manager') {
    const manager = await prisma.employee.findUnique({
      where: { email: req.user.email },
      select: { departmentId: true },
    });
    if (!manager?.departmentId || manager.departmentId !== employee.departmentId) {
      throw new ApiError('Department managers may only submit requests for their own department.', 403);
    }
  }

  const leaveType = await prisma.leaveType.findUnique({ where: { name: input.leaveType } });
  if (!leaveType) throw new ApiError('The selected leave type does not exist.', 400);

  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true },
  });
  if (overlap) throw new ApiError('This request overlaps an existing pending or approved leave request.', 409);

  const created = await prisma.$transaction(async (transaction) => {
    const request = await transaction.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: leaveType.id,
        startDate,
        endDate,
        reason: input.reason ?? null,
      },
      include: { leaveType: { select: { name: true } } },
    });
    await transaction.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: 'LEAVE_REQUEST_CREATED',
        entityType: 'leave_request',
        entityId: request.id,
      },
    });
    return request;
  });

  return res.status(201).json({ leaveRequest: toLeaveRequestRecord(created) });
});

router.patch('/:id', authenticate, authorize(['admin', 'hr_manager']), async (req, res) => {
  const id = getRouteParam(req, 'id');
  const parsed = z.object({ status: z.enum(leaveStatuses) }).strict().safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  if (parsed.data.status === 'pending') throw new ApiError('A request cannot be returned to pending.', 400);

  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.leaveRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: parsed.data.status.toUpperCase() as LeaveStatus },
    });
    if (result.count === 0) {
      const exists = await transaction.leaveRequest.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!exists) throw new ApiError('Leave request not found.', 404);
      throw new ApiError('Only pending leave requests can be reviewed.', 409);
    }

    const request = await transaction.leaveRequest.findUniqueOrThrow({
      where: { id },
      include: { leaveType: { select: { name: true } } },
    });
    await transaction.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: `LEAVE_REQUEST_${parsed.data.status.toUpperCase()}`,
        entityType: 'leave_request',
        entityId: request.id,
      },
    });
    return request;
  });

  return res.json({ leaveRequest: toLeaveRequestRecord(updated) });
});

export default router;
