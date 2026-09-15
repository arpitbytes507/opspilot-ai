import { Router } from 'express';

import {
  createApiKey,
  createEnvironment,
  createProject,
  createService,
  deleteEnvironment,
  deleteProject,
  deleteService,
  getApiKey,
  getEnvironment,
  getProject,
  getService,
  listApiKeys,
  listEnvironments,
  listProjects,
  listServices,
  revokeApiKey,
  rotateApiKey,
  updateEnvironment,
  updateProject,
  updateService,
} from '../controllers/resourceController';
import { requireAuth } from '../middleware/auth';
import { requireOrganizationMembership, requireRole } from '../middleware/organization';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const read = [requireAuth, requireOrganizationMembership];
const manage = [requireAuth, requireOrganizationMembership, requireRole('ADMIN')];

router.get('/:organizationId/projects', ...read, asyncHandler(listProjects));
router.post('/:organizationId/projects', ...manage, asyncHandler(createProject));
router.get('/:organizationId/projects/:projectId', ...read, asyncHandler(getProject));
router.patch('/:organizationId/projects/:projectId', ...manage, asyncHandler(updateProject));
router.delete('/:organizationId/projects/:projectId', ...manage, asyncHandler(deleteProject));

router.get('/:organizationId/projects/:projectId/services', ...read, asyncHandler(listServices));
router.post('/:organizationId/projects/:projectId/services', ...manage, asyncHandler(createService));
router.get('/:organizationId/projects/:projectId/services/:serviceId', ...read, asyncHandler(getService));
router.patch('/:organizationId/projects/:projectId/services/:serviceId', ...manage, asyncHandler(updateService));
router.delete('/:organizationId/projects/:projectId/services/:serviceId', ...manage, asyncHandler(deleteService));

router.get('/:organizationId/projects/:projectId/services/:serviceId/environments', ...read, asyncHandler(listEnvironments));
router.post('/:organizationId/projects/:projectId/services/:serviceId/environments', ...manage, asyncHandler(createEnvironment));
router.get('/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId', ...read, asyncHandler(getEnvironment));
router.patch('/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId', ...manage, asyncHandler(updateEnvironment));
router.delete('/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId', ...manage, asyncHandler(deleteEnvironment));

router.get('/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId/api-keys', ...read, asyncHandler(listApiKeys));
router.post('/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId/api-keys', ...manage, asyncHandler(createApiKey));
router.get('/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId/api-keys/:apiKeyId', ...read, asyncHandler(getApiKey));
router.post('/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId/api-keys/:apiKeyId/revoke', ...manage, asyncHandler(revokeApiKey));
router.post('/:organizationId/projects/:projectId/services/:serviceId/environments/:environmentId/api-keys/:apiKeyId/rotate', ...manage, asyncHandler(rotateApiKey));

export default router;
