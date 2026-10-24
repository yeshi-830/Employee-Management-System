import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { leaveRequests } from '../lib/mockData.js';

const router = Router();

router.get('/', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), (_req, res) => {
  return res.json({ leaveRequests });
});

router.post('/', authenticate, authorize(['admin', 'hr_manager', 'employee']), (req, res) => {
  const payload = req.body;
  const newRequest = {
    id: `leave-${leaveRequests.length + 1}`,
    employeeId: payload.employeeId ?? 'emp-2',
    leaveType: payload.leaveType ?? 'Annual Leave',
    startDate: payload.startDate ?? '2026-12-01',
    endDate: payload.endDate ?? '2026-12-03',
    reason: payload.reason ?? 'Personal time',
    status: payload.status ?? 'pending',
  };

  leaveRequests.push(newRequest);
  return res.status(201).json({ leaveRequest: newRequest });
});

router.patch('/:id', authenticate, authorize(['admin', 'hr_manager']), (req, res) => {
  const request = leaveRequests.find((item) => item.id === req.params.id);

  if (!request) {
    return res.status(404).json({ message: 'Leave request not found.' });
  }

  Object.assign(request, req.body);
  return res.json({ leaveRequest: request });
});

export default router;
