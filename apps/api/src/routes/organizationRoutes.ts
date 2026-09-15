import { Router } from 'express';

import {
  getOrganization,
  listMembers,
  listOrganizations,
  updateMemberRole,
} from '../controllers/organizationController';
import { requireAuth } from '../middleware/auth';
import { requireOrganizationMembership, requireRole } from '../middleware/organization';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', requireAuth, asyncHandler(listOrganizations));
router.get('/:organizationId', requireAuth, requireOrganizationMembership, asyncHandler(getOrganization));
router.get(
  '/:organizationId/members',
  requireAuth,
  requireOrganizationMembership,
  asyncHandler(listMembers),
);
router.patch(
  '/:organizationId/members/:userId',
  requireAuth,
  requireOrganizationMembership,
  requireRole('OWNER'),
  asyncHandler(updateMemberRole),
);

export default router;