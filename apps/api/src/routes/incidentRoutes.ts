import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requirePrimaryOrganizationMembership, requireRole } from '../middleware/organization';
import { asyncHandler } from '../utils/asyncHandler';
import { getIncident, listIncidentDeployments, listIncidentEvents, listIncidents, updateIncident } from '../controllers/incidentController';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(listIncidents));
router.get('/:incidentId', asyncHandler(getIncident));
router.get('/:incidentId/events', asyncHandler(listIncidentEvents));
router.get('/:incidentId/deployments', asyncHandler(listIncidentDeployments));
router.patch('/:incidentId', requirePrimaryOrganizationMembership, requireRole('MEMBER'), asyncHandler(updateIncident));
export default router;