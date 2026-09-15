import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const userId = '00000000-0000-4000-8000-000000000101';
const organizationId = '00000000-0000-4000-8000-000000000102';
const otherOrganizationId = '00000000-0000-4000-8000-000000000103';
const projectId = '00000000-0000-4000-8000-000000000104';
const environmentId = '00000000-0000-4000-8000-000000000105';
const apiKeyId = '00000000-0000-4000-8000-000000000106';
const passwordHash = await bcrypt.hash('secure-password', 4);

process.env.AUTH_SECRET = 'test-auth-secret-that-is-at-least-32-characters';
process.env.AUTH_COOKIE_NAME = 'resource_test_auth';
process.env.NODE_ENV = 'test';

const { default: app } = await import('../src/app');
const { prisma } = await import('../src/lib/prisma');

const userFindUnique = vi.spyOn(prisma.user, 'findUnique');
const userUpdate = vi.spyOn(prisma.user, 'update');
const membershipFindMany = vi.spyOn(prisma.organizationMember, 'findMany');
const membershipFindUnique = vi.spyOn(prisma.organizationMember, 'findUnique');
const projectFindFirst = vi.spyOn(prisma.project, 'findFirst');
const projectFindMany = vi.spyOn(prisma.project, 'findMany');
const projectCreate = vi.spyOn(prisma.project, 'create');
const auditCreate = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never);
const environmentFindFirst = vi.spyOn(prisma.serviceEnvironment, 'findFirst');
const apiKeyCreate = vi.spyOn(prisma.apiKey, 'create');
const apiKeyFindMany = vi.spyOn(prisma.apiKey, 'findMany');

const user = { id: userId, email: 'resource@example.com', name: 'Resource User', avatarUrl: null, isActive: true, passwordHash };
const membership = { organizationId, userId, role: 'OWNER' as const };

const login = async () => {
  userFindUnique.mockResolvedValue(user as never);
  userUpdate.mockResolvedValue(user as never);
  membershipFindMany.mockResolvedValue([]);
  const response = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'secure-password' });
  return response.headers['set-cookie'];
};

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue(user as never);
  membershipFindMany.mockResolvedValue([]);
  membershipFindUnique.mockResolvedValue(membership as never);
  projectFindFirst.mockResolvedValue(null);
  projectFindMany.mockResolvedValue([]);
  environmentFindFirst.mockResolvedValue(null);
  auditCreate.mockResolvedValue({} as never);
});

describe('Phase 4 resource authorization and API key security', () => {
  it('creates projects only for the verified organization and rejects duplicate slugs', async () => {
    const cookie = await login();
    projectCreate.mockResolvedValue({ id: projectId, organizationId, name: 'Payments', slug: 'payments', description: null, createdAt: new Date(), updatedAt: new Date() } as never);
    const created = await request(app).post(`/api/v1/organizations/${organizationId}/projects`).set('Cookie', cookie).send({ name: ' Payments ', slug: 'payments' });
    expect(created.status).toBe(201);
    expect(projectCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId, name: 'Payments' }) }));

    projectFindFirst.mockResolvedValue({ id: projectId } as never);
    const duplicate = await request(app).post(`/api/v1/organizations/${organizationId}/projects`).set('Cookie', cookie).send({ name: 'Other', slug: 'payments' });
    expect(duplicate.status).toBe(409);
  });

  it('rejects an organization without membership before querying projects', async () => {
    const cookie = await login();
    membershipFindUnique.mockResolvedValue(null);
    const response = await request(app).get(`/api/v1/organizations/${otherOrganizationId}/projects`).set('Cookie', cookie);
    expect(response.status).toBe(403);
    expect(projectFindMany).not.toHaveBeenCalled();
  });

  it('lists API key metadata without returning the hash or secret', async () => {
    const cookie = await login();
    environmentFindFirst.mockResolvedValue({ id: environmentId, organizationId, serviceId: '00000000-0000-4000-8000-000000000107', name: 'production' } as never);
    apiKeyFindMany.mockResolvedValue([{ id: apiKeyId, name: 'Ingestion', keyPrefix: 'opspk_abc123', keyHash: 'private-hash', lastUsedAt: null, expiresAt: null, revokedAt: null, createdAt: new Date(), updatedAt: new Date(), organizationId, serviceEnvironmentId: environmentId } ] as never);
    const response = await request(app).get(`/api/v1/organizations/${organizationId}/projects/${projectId}/services/00000000-0000-4000-8000-000000000107/environments/${environmentId}/api-keys`).set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.data[0].keyHash).toBeUndefined();
    expect(response.body.data[0].secret).toBeUndefined();
  });

  it('returns a high-entropy secret only when creating a key and audits the prefix only', async () => {
    const cookie = await login();
    environmentFindFirst.mockResolvedValue({ id: environmentId, organizationId, serviceId: '00000000-0000-4000-8000-000000000107', name: 'production' } as never);
    apiKeyCreate.mockImplementation(async ({ data }) => ({ id: apiKeyId, ...data, lastUsedAt: null, revokedAt: null, createdAt: new Date(), updatedAt: new Date() }) as never);
    const response = await request(app).post(`/api/v1/organizations/${organizationId}/projects/${projectId}/services/00000000-0000-4000-8000-000000000107/environments/${environmentId}/api-keys`).set('Cookie', cookie).send({ name: 'Production key' });
    expect(response.status).toBe(201);
    expect(response.body.data.secret).toMatch(/^opspk_[A-Za-z0-9_-]{43}$/);
    expect(response.body.data.apiKey.keyHash).toBeUndefined();
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: expect.not.objectContaining({ secret: expect.anything(), keyHash: expect.anything() }) }) }));
  });
});
