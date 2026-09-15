import type { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { recordAuditLog } from '../services/auditService';
import {
    getApiKeyInEnvironment,
    getEnvironmentInService,
    getProjectInOrganization,
    getServiceInProject,
} from '../services/resourceAuthorization';
import { generateApiKey } from '../utils/apiKey';
import { HttpError } from '../utils/httpError';
import {
    apiKeyIdParamsSchema,
    createApiKeySchema,
    createEnvironmentSchema,
    createProjectSchema,
    createServiceSchema,
    environmentIdParamsSchema,
    projectIdParamsSchema,
    serviceIdParamsSchema,
    updateEnvironmentSchema,
    updateProjectSchema,
    updateServiceSchema,
} from '../validators/resourceValidators';

const requestAuditContext = (req: Request) => ({
    userId: req.auth?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
});

const conflict = (message: string): never => {
    throw new HttpError(409, 'RESOURCE_HAS_DEPENDENCIES', message);
};

export const listProjects = async (req: Request, res: Response): Promise<void> => {
    const { organizationId } = projectIdParamsSchema.pick({ organizationId: true }).parse(req.params);
    const projects = await prisma.project.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } });
    res.status(200).json({ success: true, data: projects });
};

export const createProject = async (req: Request, res: Response): Promise<void> => {
    const { organizationId } = projectIdParamsSchema.pick({ organizationId: true }).parse(req.params);
    const input = createProjectSchema.parse(req.body);
    const existing = await prisma.project.findFirst({ where: { organizationId, slug: input.slug } });
    if (existing) throw new HttpError(409, 'PROJECT_SLUG_EXISTS', 'A project with this slug already exists in the organization');
    const project = await prisma.project.create({ data: { ...input, organizationId } });
    await recordAuditLog({ organizationId, action: 'PROJECT_CREATED', resourceType: 'PROJECT', resourceId: project.id, ...requestAuditContext(req), metadata: { name: project.name, slug: project.slug } });
    res.status(201).json({ success: true, data: project });
};

export const getProject = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId } = projectIdParamsSchema.parse(req.params);
    const project = await getProjectInOrganization(organizationId, projectId);
    res.status(200).json({ success: true, data: project });
};

export const updateProject = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId } = projectIdParamsSchema.parse(req.params);
    const input = updateProjectSchema.parse(req.body);
    await getProjectInOrganization(organizationId, projectId);
    if (input.slug) {
        const duplicate = await prisma.project.findFirst({ where: { organizationId, slug: input.slug, NOT: { id: projectId } } });
        if (duplicate) throw new HttpError(409, 'PROJECT_SLUG_EXISTS', 'A project with this slug already exists in the organization');
    }
    const project = await prisma.project.update({ where: { id: projectId }, data: input });
    await recordAuditLog({ organizationId, action: 'PROJECT_UPDATED', resourceType: 'PROJECT', resourceId: project.id, ...requestAuditContext(req), metadata: { name: project.name, slug: project.slug } });
    res.status(200).json({ success: true, data: project });
};

export const deleteProject = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId } = projectIdParamsSchema.parse(req.params);
    const project = await getProjectInOrganization(organizationId, projectId);
    const [services, events, incidents, deployments] = await Promise.all([
        prisma.service.count({ where: { projectId } }),
        prisma.event.count({ where: { projectId } }),
        prisma.incident.count({ where: { projectId } }),
        prisma.deployment.count({ where: { projectId } }),
    ]);
    if (services || events || incidents || deployments) conflict('Project cannot be deleted while it has services, events, incidents, or deployments');
    await prisma.project.delete({ where: { id: projectId } });
    await recordAuditLog({ organizationId, action: 'PROJECT_DELETED', resourceType: 'PROJECT', resourceId: projectId, ...requestAuditContext(req), metadata: { name: project.name } });
    res.status(200).json({ success: true, data: { id: projectId } });
};

export const listServices = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId } = projectIdParamsSchema.parse(req.params);
    await getProjectInOrganization(organizationId, projectId);
    const services = await prisma.service.findMany({ where: { organizationId, projectId }, orderBy: { createdAt: 'asc' } });
    res.status(200).json({ success: true, data: services });
};

export const createService = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId } = projectIdParamsSchema.parse(req.params);
    const input = createServiceSchema.parse(req.body);
    await getProjectInOrganization(organizationId, projectId);
    const existing = await prisma.service.findFirst({ where: { projectId, slug: input.slug } });
    if (existing) throw new HttpError(409, 'SERVICE_SLUG_EXISTS', 'A service with this slug already exists in the project');
    const service = await prisma.service.create({ data: { ...input, organizationId, projectId } });
    await recordAuditLog({ organizationId, action: 'SERVICE_CREATED', resourceType: 'SERVICE', resourceId: service.id, ...requestAuditContext(req), metadata: { name: service.name, slug: service.slug } });
    res.status(201).json({ success: true, data: service });
};

export const getService = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId } = serviceIdParamsSchema.parse(req.params);
    const service = await getServiceInProject(organizationId, projectId, serviceId);
    res.status(200).json({ success: true, data: service });
};

export const updateService = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId } = serviceIdParamsSchema.parse(req.params);
    const input = updateServiceSchema.parse(req.body);
    await getServiceInProject(organizationId, projectId, serviceId);
    if (input.slug) {
        const duplicate = await prisma.service.findFirst({ where: { projectId, slug: input.slug, NOT: { id: serviceId } } });
        if (duplicate) throw new HttpError(409, 'SERVICE_SLUG_EXISTS', 'A service with this slug already exists in the project');
    }
    const service = await prisma.service.update({ where: { id: serviceId }, data: input });
    await recordAuditLog({ organizationId, action: 'SERVICE_UPDATED', resourceType: 'SERVICE', resourceId: service.id, ...requestAuditContext(req), metadata: { name: service.name, slug: service.slug } });
    res.status(200).json({ success: true, data: service });
};

export const deleteService = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId } = serviceIdParamsSchema.parse(req.params);
    const service = await getServiceInProject(organizationId, projectId, serviceId);
    const [environments, events, incidents, deployments] = await Promise.all([
        prisma.serviceEnvironment.count({ where: { serviceId } }),
        prisma.event.count({ where: { serviceId } }),
        prisma.incident.count({ where: { serviceId } }),
        prisma.deployment.count({ where: { serviceId } }),
    ]);
    if (environments || events || incidents || deployments) conflict('Service cannot be deleted while it has environments, events, incidents, or deployments');
    await prisma.service.delete({ where: { id: serviceId } });
    await recordAuditLog({ organizationId, action: 'SERVICE_DELETED', resourceType: 'SERVICE', resourceId: serviceId, ...requestAuditContext(req), metadata: { name: service.name } });
    res.status(200).json({ success: true, data: { id: serviceId } });
};

export const listEnvironments = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId } = serviceIdParamsSchema.parse(req.params);
    await getServiceInProject(organizationId, projectId, serviceId);
    const environments = await prisma.serviceEnvironment.findMany({ where: { organizationId, serviceId }, orderBy: { createdAt: 'asc' } });
    res.status(200).json({ success: true, data: environments });
};

export const createEnvironment = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId } = serviceIdParamsSchema.parse(req.params);
    const input = createEnvironmentSchema.parse(req.body);
    await getServiceInProject(organizationId, projectId, serviceId);
    const existing = await prisma.serviceEnvironment.findFirst({ where: { serviceId, name: input.name } });
    if (existing) throw new HttpError(409, 'ENVIRONMENT_EXISTS', 'An environment with this name already exists in the service');
    const environment = await prisma.serviceEnvironment.create({ data: { ...input, organizationId, serviceId } });
    await recordAuditLog({ organizationId, action: 'ENVIRONMENT_CREATED', resourceType: 'SERVICE_ENVIRONMENT', resourceId: environment.id, ...requestAuditContext(req), metadata: { name: environment.name } });
    res.status(201).json({ success: true, data: environment });
};

export const getEnvironment = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId, environmentId } = environmentIdParamsSchema.parse(req.params);
    const environment = await getEnvironmentInService(organizationId, projectId, serviceId, environmentId);
    res.status(200).json({ success: true, data: environment });
};

export const updateEnvironment = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId, environmentId } = environmentIdParamsSchema.parse(req.params);
    const input = updateEnvironmentSchema.parse(req.body);
    await getEnvironmentInService(organizationId, projectId, serviceId, environmentId);
    const duplicate = await prisma.serviceEnvironment.findFirst({ where: { serviceId, name: input.name, NOT: { id: environmentId } } });
    if (duplicate) throw new HttpError(409, 'ENVIRONMENT_EXISTS', 'An environment with this name already exists in the service');
    const environment = await prisma.serviceEnvironment.update({ where: { id: environmentId }, data: input });
    await recordAuditLog({ organizationId, action: 'ENVIRONMENT_UPDATED', resourceType: 'SERVICE_ENVIRONMENT', resourceId: environment.id, ...requestAuditContext(req), metadata: { name: environment.name } });
    res.status(200).json({ success: true, data: environment });
};

export const deleteEnvironment = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId, environmentId } = environmentIdParamsSchema.parse(req.params);
    const environment = await getEnvironmentInService(organizationId, projectId, serviceId, environmentId);
    const [apiKeys, events, incidents, deployments] = await Promise.all([
        prisma.apiKey.count({ where: { serviceEnvironmentId: environmentId } }),
        prisma.event.count({ where: { serviceEnvironmentId: environmentId } }),
        prisma.incident.count({ where: { serviceEnvironmentId: environmentId } }),
        prisma.deployment.count({ where: { serviceEnvironmentId: environmentId } }),
    ]);
    if (apiKeys || events || incidents || deployments) conflict('Environment cannot be deleted while it has API keys, events, incidents, or deployments');
    await prisma.serviceEnvironment.delete({ where: { id: environmentId } });
    await recordAuditLog({ organizationId, action: 'ENVIRONMENT_DELETED', resourceType: 'SERVICE_ENVIRONMENT', resourceId: environmentId, ...requestAuditContext(req), metadata: { name: environment.name } });
    res.status(200).json({ success: true, data: { id: environmentId } });
};

const apiKeyMetadata = (apiKey: { id: string; name: string; keyPrefix: string; lastUsedAt: Date | null; expiresAt: Date | null; revokedAt: Date | null; createdAt: Date }) => ({
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    lastUsedAt: apiKey.lastUsedAt,
    expiresAt: apiKey.expiresAt,
    revokedAt: apiKey.revokedAt,
    createdAt: apiKey.createdAt,
});

export const listApiKeys = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId, environmentId } = environmentIdParamsSchema.parse(req.params);
    await getEnvironmentInService(organizationId, projectId, serviceId, environmentId);
    const apiKeys = await prisma.apiKey.findMany({ where: { organizationId, serviceEnvironmentId: environmentId }, orderBy: { createdAt: 'desc' } });
    res.status(200).json({ success: true, data: apiKeys.map(apiKeyMetadata) });
};

export const createApiKey = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId, environmentId } = environmentIdParamsSchema.parse(req.params);
    const input = createApiKeySchema.parse(req.body);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
    if (expiresAt && expiresAt <= new Date()) throw new HttpError(400, 'API_KEY_ALREADY_EXPIRED', 'API key expiration must be in the future');
    const environment = await getEnvironmentInService(organizationId, projectId, serviceId, environmentId);
    const generated = generateApiKey();
    const apiKey = await prisma.apiKey.create({ data: { organizationId, serviceEnvironmentId: environment.id, name: input.name, keyPrefix: generated.keyPrefix, keyHash: generated.keyHash, expiresAt } });
    await recordAuditLog({ organizationId, action: 'API_KEY_CREATED', resourceType: 'API_KEY', resourceId: apiKey.id, ...requestAuditContext(req), metadata: { name: apiKey.name, keyPrefix: apiKey.keyPrefix, environmentName: environment.name } });
    res.status(201).json({ success: true, data: { apiKey: apiKeyMetadata(apiKey), secret: generated.secret } });
};

export const getApiKey = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId, environmentId, apiKeyId } = apiKeyIdParamsSchema.parse(req.params);
    const apiKey = await getApiKeyInEnvironment(organizationId, projectId, serviceId, environmentId, apiKeyId);
    res.status(200).json({ success: true, data: apiKeyMetadata(apiKey) });
};

export const revokeApiKey = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId, environmentId, apiKeyId } = apiKeyIdParamsSchema.parse(req.params);
    const apiKey = await getApiKeyInEnvironment(organizationId, projectId, serviceId, environmentId, apiKeyId);
    if (!apiKey.revokedAt) {
        await prisma.apiKey.update({ where: { id: apiKeyId }, data: { revokedAt: new Date() } });
        await recordAuditLog({ organizationId, action: 'API_KEY_REVOKED', resourceType: 'API_KEY', resourceId: apiKeyId, ...requestAuditContext(req), metadata: { name: apiKey.name, keyPrefix: apiKey.keyPrefix } });
    }
    res.status(200).json({ success: true, data: { id: apiKeyId, revokedAt: apiKey.revokedAt || new Date() } });
};

export const rotateApiKey = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, projectId, serviceId, environmentId, apiKeyId } = apiKeyIdParamsSchema.parse(req.params);
    const oldKey = await getApiKeyInEnvironment(organizationId, projectId, serviceId, environmentId, apiKeyId);
    const generated = generateApiKey();
    const now = new Date();
    const newKey = await prisma.$transaction(async (tx) => {
        await tx.apiKey.update({ where: { id: oldKey.id }, data: { revokedAt: oldKey.revokedAt || now } });
        return tx.apiKey.create({ data: { organizationId, serviceEnvironmentId: oldKey.serviceEnvironmentId, name: oldKey.name, keyPrefix: generated.keyPrefix, keyHash: generated.keyHash, expiresAt: oldKey.expiresAt } });
    });
    await recordAuditLog({ organizationId, action: 'API_KEY_ROTATED', resourceType: 'API_KEY', resourceId: newKey.id, ...requestAuditContext(req), metadata: { previousApiKeyId: oldKey.id, keyPrefix: newKey.keyPrefix, name: newKey.name } });
    res.status(201).json({ success: true, data: { apiKey: apiKeyMetadata(newKey), secret: generated.secret } });
};
