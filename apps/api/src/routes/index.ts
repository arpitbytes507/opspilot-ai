import { Router } from 'express';

import { getHealth } from '../controllers/healthController';
import authRoutes from './authRoutes';
import organizationRoutes from './organizationRoutes';
import resourceRoutes from './resourceRoutes';
import incidentRoutes from './incidentRoutes';
import dashboardRoutes from './dashboardRoutes';

const router = Router();

router.get('/health', getHealth);
router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/organizations', resourceRoutes);
router.use('/incidents', incidentRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
