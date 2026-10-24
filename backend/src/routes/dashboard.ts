import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getDashboardSummary } from '../lib/mockData.js';

const router = Router();

router.get('/summary', authenticate, authorize(['admin', 'hr_manager', 'department_manager', 'employee']), (_req, res) => {
  return res.json(getDashboardSummary());
});

export default router;
