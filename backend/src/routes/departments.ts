import { Router } from 'express';
import { z } from 'zod';
import { ApiError, getRouteParam } from '../lib/apiError.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
const departmentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  budget: z.number().finite().nonnegative().nullable().optional(),
  managerId: z.string().min(1).nullable().optional(),
}).strict();

function toDepartmentRecord(department: {
  id: string;
  name: string;
  description: string | null;
  managerId: string | null;
  _count?: { employees: number };
}) {
  return {
    id: department.id,
    name: department.name,
    description: department.description ?? '',
    managerId: department.managerId,
    employeeCount: department._count?.employees ?? 0,
  };
}

async function validateManager(managerId: string | null | undefined) {
  if (!managerId) return;
  const employee = await prisma.employee.findUnique({
    where: { id: managerId },
    select: { id: true },
  });
  if (!employee) throw new ApiError('Department manager must be an existing employee.', 400);
}

router.get('/', authenticate, authorize(['admin', 'hr_manager', 'department_manager']), async (req, res) => {
  const where = req.user?.role === 'department_manager'
    ? {
      id: (await prisma.employee.findUnique({
        where: { email: req.user.email },
        select: { departmentId: true },
      }))?.departmentId ?? '__no_department__',
    }
    : {};

  const departments = await prisma.department.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { employees: { where: { isArchived: false } } } },
    },
  });

  return res.json({ departments: departments.map(toDepartmentRecord) });
});

router.post('/', authenticate, authorize(['admin', 'hr_manager']), async (req, res) => {
  const parsed = departmentSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  await validateManager(parsed.data.managerId);

  const department = await prisma.$transaction(async (transaction) => {
    const created = await transaction.department.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        budget: parsed.data.budget ?? null,
        managerId: parsed.data.managerId ?? null,
      },
    });
    await transaction.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: 'DEPARTMENT_CREATED',
        entityType: 'department',
        entityId: created.id,
      },
    });
    return created;
  });

  return res.status(201).json({ department: toDepartmentRecord(department) });
});

router.patch('/:id', authenticate, authorize(['admin', 'hr_manager']), async (req, res) => {
  const id = getRouteParam(req, 'id');
  const parsed = departmentSchema.partial().strict().safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  if (Object.keys(parsed.data).length === 0) throw new ApiError('At least one department field is required.', 400);
  await validateManager(parsed.data.managerId);

  const department = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.department.update({
      where: { id },
      data: parsed.data,
    });
    await transaction.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: 'DEPARTMENT_UPDATED',
        entityType: 'department',
        entityId: updated.id,
      },
    });
    return updated;
  });

  return res.json({ department: toDepartmentRecord(department) });
});

export default router;
