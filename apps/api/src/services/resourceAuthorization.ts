import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/httpError';

const notFound = (resource: string): never => {
  throw new HttpError(404, `${resource.toUpperCase()}_NOT_FOUND`, `${resource} not found`);
};

export const getProjectInOrganization = async (organizationId: string, projectId: string) => {
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId } });
  return project || notFound('Project');
};

export const getServiceInProject = async (organizationId: string, projectId: string, serviceId: string) => {
  const service = await prisma.service.findFirst({ where: { id: serviceId, projectId, organizationId } });
  return service || notFound('Service');
};

export const getEnvironmentInService = async (organizationId: string, projectId: string, serviceId: string, environmentId: string) => {
  const environment = await prisma.serviceEnvironment.findFirst({
    where: { id: environmentId, serviceId, organizationId, service: { projectId, organizationId } },
  });
  return environment || notFound('Environment');
};

export const getApiKeyInEnvironment = async (organizationId: string, projectId: string, serviceId: string, environmentId: string, apiKeyId: string) => {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      organizationId,
      serviceEnvironmentId: environmentId,
      serviceEnvironment: { serviceId, organizationId, service: { projectId, organizationId } },
    },
  });
  return apiKey || notFound('API key');
};
