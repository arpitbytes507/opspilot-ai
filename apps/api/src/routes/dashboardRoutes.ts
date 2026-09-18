import { Router } from 'express';
import { getDashboardSummary } from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.get('/summary', requireAuth, asyncHandler(getDashboardSummary));
export default router;