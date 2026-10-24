import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { departments, employees, type Employee } from '../lib/mockData.js';

const router = Router();

router.get('/', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), (_req, res) => {
  return res.json({ employees });
});

router.get('/:id', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), (req, res) => {
  const employee = employees.find((item) => item.id === req.params.id);

  if (!employee) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  return res.json({ employee });
});

router.post('/', authenticate, authorize(['admin', 'hr_manager', 'department_manager']), (req, res) => {
  const payload = req.body as Partial<Employee>;
  const nextId = `emp-${employees.length + 1}`;

  const employee: Employee = {
    id: nextId,
    employeeNumber: payload.employeeNumber ?? `EMP-${String(employees.length + 100)}`,
    firstName: payload.firstName ?? 'New',
    lastName: payload.lastName ?? 'Employee',
    email: payload.email ?? `${nextId}@northstar.example`,
    phone: payload.phone ?? '+1-555-0100',
    departmentId: payload.departmentId ?? departments[0]?.id ?? 'dept-1',
    jobTitle: payload.jobTitle ?? 'Employee',
    managerId: payload.managerId ?? null,
    hireDate: payload.hireDate ?? new Date().toISOString().slice(0, 10),
    employmentStatus: payload.employmentStatus ?? 'active',
    isArchived: false,
  };

  employees.push(employee);
  return res.status(201).json({ employee });
});

router.patch('/:id', authenticate, authorize(['admin', 'hr_manager', 'department_manager']), (req, res) => {
  const employee = employees.find((item) => item.id === req.params.id);

  if (!employee) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  Object.assign(employee, req.body);
  return res.json({ employee });
});

router.delete('/:id', authenticate, authorize(['admin', 'hr_manager']), (req, res) => {
  const employeeIndex = employees.findIndex((item) => item.id === req.params.id);

  if (employeeIndex === -1) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  employees[employeeIndex] = {
    ...employees[employeeIndex],
    isArchived: true,
    employmentStatus: 'inactive',
  };

  return res.json({ message: 'Employee archived successfully.' });
});

export default router;
