import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), async (req, res) => {
  const user = req.user!;
  const ownEmployee = user.role === 'employee' || user.role === 'department_manager'
    ? await prisma.employee.findUnique({
      where: { email: user.email },
      select: { id: true, departmentId: true },
    })
    : null;
  const employeeScope: Prisma.EmployeeWhereInput = { isArchived: false };
  const departmentScope: Prisma.DepartmentWhereInput = {};
  const leaveScope: Prisma.LeaveRequestWhereInput = { status: 'PENDING' };

  if (user.role === 'employee') {
    employeeScope.id = ownEmployee?.id ?? '__no_employee__';
    departmentScope.id = ownEmployee?.departmentId ?? '__no_department__';
    leaveScope.employeeId = ownEmployee?.id ?? '__no_employee__';
  } else if (user.role === 'department_manager') {
    const departmentId = ownEmployee?.departmentId ?? '__no_department__';
    employeeScope.departmentId = departmentId;
    departmentScope.id = departmentId;
    leaveScope.employee = { is: { departmentId } };
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [totalEmployees, activeEmployees, inactiveEmployees, newEmployees, pendingLeave, statusGroups, departments, recentHires] = await prisma.$transaction([
    prisma.employee.count({ where: employeeScope }),
    prisma.employee.count({ where: { ...employeeScope, employmentStatus: 'ACTIVE' } }),
    prisma.employee.count({ where: { ...employeeScope, employmentStatus: 'INACTIVE' } }),
    prisma.employee.count({ where: { ...employeeScope, hireDate: { gte: monthStart } } }),
    prisma.leaveRequest.count({ where: leaveScope }),
    prisma.employee.groupBy({ by: ['employmentStatus'], where: employeeScope, _count: { _all: true } }),
    prisma.department.findMany({
      where: departmentScope,
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: { where: { isArchived: false } } } } },
    }),
    prisma.employee.findMany({
      where: employeeScope,
      orderBy: { hireDate: 'desc' },
      take: 3,
    }),
  ]);

  return res.json({
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    newEmployees,
    pendingLeave,
    employeesByStatus: statusGroups.map((group) => ({
      status: group.employmentStatus.toLowerCase(),
      total: group._count._all,
    })),
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
