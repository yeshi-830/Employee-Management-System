import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), async (req, res) => {
  const user = req.user!;
  const recentHireScope = user.role === 'employee'
    ? { email: user.email }
    : user.role === 'department_manager'
      ? {
        departmentId: (await prisma.employee.findUnique({
          where: { email: user.email },
          select: { departmentId: true },
        }))?.departmentId ?? '__no_department__',
      }
      : {};

  const [totalEmployees, activeEmployees, pendingLeave, departments, recentHires] = await prisma.$transaction([
    prisma.employee.count({ where: { isArchived: false } }),
    prisma.employee.count({ where: { isArchived: false, employmentStatus: 'ACTIVE' } }),
    prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: { where: { isArchived: false } } } } },
    }),
    prisma.employee.findMany({
      where: { ...recentHireScope, isArchived: false },
      orderBy: { hireDate: 'desc' },
      take: 3,
    }),
  ]);

  return res.json({
    totalEmployees,
    activeEmployees,
    pendingLeave,
    employeesByDepartment: departments.map((department) => ({
      id: department.id,
      name: department.name,
      total: department._count.employees,
    })),
    recentHires: recentHires.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone ?? '',
      departmentId: employee.departmentId ?? '',
      jobTitle: employee.jobTitle,
      managerId: employee.managerId,
      hireDate: employee.hireDate.toISOString().slice(0, 10),
      employmentStatus: employee.employmentStatus.toLowerCase(),
      isArchived: employee.isArchived,
    })),
  });
});

export default router;
