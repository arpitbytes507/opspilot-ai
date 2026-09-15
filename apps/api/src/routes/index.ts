import { Router } from 'express';

import { getHealth } from '../controllers/healthController';
import authRoutes from './authRoutes';
import organizationRoutes from './organizationRoutes';

const router = Router();

router.get('/health', getHealth);
router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);

export default router;
