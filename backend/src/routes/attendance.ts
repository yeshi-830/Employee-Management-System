import { Prisma } from '@prisma/client';
import type { EmploymentStatus, Prisma as PrismaTypes } from '@prisma/client';
import { Router } from 'express';
import { ApiError, parsePagination } from '../lib/apiError.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

const employeeSelection = {
  employeeNumber: true,
  firstName: true,
  lastName: true,
  department: { select: { name: true } },
} as const;

function toAttendanceRecord(record: {
  id: string;
  employeeId: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department: { name: string } | null;
  };
}) {
  return {
    id: record.id,
    employeeId: record.employeeId,
    employeeNumber: record.employee.employeeNumber,
    employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
    departmentName: record.employee.department?.name ?? 'Unassigned',
    clockInAt: record.clockInAt.toISOString(),
    clockOutAt: record.clockOutAt?.toISOString() ?? null,
  };
}

async function getEmployeeForUser(email: string) {
  return prisma.employee.findUnique({
    where: { email },
    select: {
      id: true,
      departmentId: true,
      isArchived: true,
      employmentStatus: true,
    },
  });
}

function canClock(employee: { isArchived: boolean; employmentStatus: EmploymentStatus } | null) {
  return Boolean(employee && !employee.isArchived && employee.employmentStatus !== 'INACTIVE');
}

router.get('/', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), async (req, res) => {
  const { page, pageSize } = parsePagination(req);
  const user = req.user!;
  const ownEmployee = await getEmployeeForUser(user.email);
  const where: PrismaTypes.AttendanceRecordWhereInput = {};

  if (user.role === 'employee') {
    where.employeeId = ownEmployee?.id ?? '__no_employee__';
  } else if (user.role === 'department_manager') {
    where.employee = { is: { departmentId: ownEmployee?.departmentId ?? '__no_department__' } };
  }

  const [records, total, activeRecord] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: { employee: { select: employeeSelection } },
      orderBy: [{ clockInAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.attendanceRecord.count({ where }),
    ownEmployee
      ? prisma.attendanceRecord.findUnique({
        where: { openForEmployeeId: ownEmployee.id },
        include: { employee: { select: employeeSelection } },
      })
      : Promise.resolve(null),
  ]);

  return res.json({
    attendanceRecords: records.map(toAttendanceRecord),
    activeRecord: activeRecord ? toAttendanceRecord(activeRecord) : null,
    canClock: canClock(ownEmployee),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

router.post('/clock-in', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), async (req, res) => {
  const user = req.user!;
  const employee = await getEmployeeForUser(user.email);
  if (!employee) throw new ApiError('Your account is not linked to an employee profile.', 403);
  if (!canClock(employee)) throw new ApiError('Inactive or archived employees cannot clock in.', 403);

  try {
    const record = await prisma.$transaction(async (transaction) => {
      const attendance = await transaction.attendanceRecord.create({
        data: {
          employeeId: employee.id,
          openForEmployeeId: employee.id,
        },
        include: { employee: { select: employeeSelection } },
      });

      await transaction.auditEvent.create({
        data: {
          actorId: user.id,
          action: 'ATTENDANCE_CLOCKED_IN',
          entityType: 'attendance',
          entityId: attendance.id,
        },
      });
      return attendance;
    });

    return res.status(201).json({ attendanceRecord: toAttendanceRecord(record) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError('You are already clocked in.', 409);
    }
    throw error;
  }
});

router.post('/clock-out', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), async (req, res) => {
  const user = req.user!;
  const employee = await getEmployeeForUser(user.email);
  if (!employee) throw new ApiError('Your account is not linked to an employee profile.', 403);

  const record = await prisma.$transaction(async (transaction) => {
    const activeRecord = await transaction.attendanceRecord.findUnique({
      where: { openForEmployeeId: employee.id },
    });
    if (!activeRecord) throw new ApiError('You are not currently clocked in.', 409);

    const clockOutAt = new Date();
    const result = await transaction.attendanceRecord.updateMany({
      where: {
        id: activeRecord.id,
        openForEmployeeId: employee.id,
        clockOutAt: null,
      },
      data: {
        clockOutAt,
        openForEmployeeId: null,
      },
    });
    if (result.count !== 1) throw new ApiError('This attendance session has already been closed.', 409);

    const updated = await transaction.attendanceRecord.findUniqueOrThrow({
      where: { id: activeRecord.id },
      include: { employee: { select: employeeSelection } },
    });
    await transaction.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'ATTENDANCE_CLOCKED_OUT',
        entityType: 'attendance',
        entityId: updated.id,
      },
    });
    return updated;
  });

  return res.json({ attendanceRecord: toAttendanceRecord(record) });
});

export default router;
