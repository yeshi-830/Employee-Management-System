import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { departments, type Department } from '../lib/mockData.js';

const router = Router();

router.get('/', authenticate, authorize(['admin', 'hr_manager', 'department_manager']), (_req, res) => {
  return res.json({ departments });
});

router.post('/', authenticate, authorize(['admin', 'hr_manager']), (req, res) => {
  const payload = req.body as Partial<Department>;
  const newDepartment: Department = {
    id: `dept-${departments.length + 1}`,
    name: payload.name ?? 'New Department',
    description: payload.description ?? 'Created from the EMS dashboard',
    managerId: payload.managerId ?? null,
  };

  departments.push(newDepartment);
  return res.status(201).json({ department: newDepartment });
});

export default router;
