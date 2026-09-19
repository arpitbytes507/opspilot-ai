import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.AUTH_SECRET = 'test-auth-secret-that-is-at-least-32-characters';
process.env.AUTH_COOKIE_NAME = 'test_auth';
process.env.NODE_ENV = 'test';

const userId = '00000000-0000-4000-8000-000000000101';
const organizationId = '00000000-0000-4000-8000-000000000102';
const otherOrganizationId = '00000000-0000-4000-8000-000000000103';
const projectId = '00000000-0000-4000-8000-000000000104';

const { default: app } = await import('../src/app');
const { prisma } = await import('../src/lib/prisma');
const { getPrimaryOrganization } = await import('../src/services/organizationContext');

const userFindUnique = vi.spyOn(prisma.user, 'findUnique');
const memberFindFirst = vi.spyOn(prisma.organizationMember, 'findFirst');
const memberFindMany = vi.spyOn(prisma.organizationMember, 'findMany');
const memberFindUnique = vi.spyOn(prisma.organizationMember, 'findUnique');
const projectFindMany = vi.spyOn(prisma.project, 'findMany');
const incidentGroupBy = vi.spyOn(prisma.incident, 'groupBy');
const incidentFindMany = vi.spyOn(prisma.incident, 'findMany');
const eventFindMany = vi.spyOn(prisma.event, 'findMany');
const serviceFindMany = vi.spyOn(prisma.service, 'findMany');

const user = { id: userId, email: 'member@example.com', name: 'Member', avatarUrl: null, isActive: true };
const membership = { organizationId, role: 'MEMBER', organization: { id: organizationId, name: 'Org', slug: 'org' } };
const authCookie = () => `test_auth=${jwt.sign({ userId }, process.env.AUTH_SECRET as string)}`;

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue(user as never);
  memberFindFirst.mockResolvedValue(membership as never);
  memberFindMany.mockResolvedValue([{ role: 'MEMBER', organization: membership.organization }] as never);
  memberFindUnique.mockResolvedValue({ organizationId, userId, role: 'MEMBER' } as never);
  projectFindMany.mockResolvedValue([]);
  incidentGroupBy.mockResolvedValue([]);
  incidentFindMany.mockResolvedValue([]);
  eventFindMany.mockResolvedValue([]);
  serviceFindMany.mockResolvedValue([]);
});

describe('organization membership resolution', () => {
  it('allows an authenticated member to load dashboard and projects', async () => {
    const dashboard = await request(app).get('/api/v1/dashboard/summary').set('Cookie', authCookie());
    const projects = await request(app).get(`/api/v1/organizations/${organizationId}/projects`).set('Cookie', authCookie());

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.organization.id).toBe(organizationId);
    expect(projects.status).toBe(200);
    expect(projectFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId } }));
  });

  it('returns a clear membership error when the authenticated user has none', async () => {
    memberFindFirst.mockResolvedValue(null);
    const response = await request(app).get('/api/v1/dashboard/summary').set('Cookie', authCookie());
    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({ code: 'ORGANIZATION_NOT_FOUND', message: 'No organization is available' });
  });

  it('requires authentication for dashboard and projects', async () => {
    expect((await request(app).get('/api/v1/dashboard/summary')).status).toBe(401);
    expect((await request(app).get(`/api/v1/organizations/${organizationId}/projects`)).status).toBe(401);
  });

  it('rejects a frontend organization id that is not the authenticated membership', async () => {
    memberFindUnique.mockResolvedValue(null);
    const response = await request(app).get(`/api/v1/organizations/${otherOrganizationId}/projects`).set('Cookie', authCookie());
    expect(response.status).toBe(403);
    expect(projectFindMany).not.toHaveBeenCalled();
  });

  it('selects the deterministic first membership and does not require OWNER', async () => {
    const first = { ...membership, role: 'VIEWER' };
    memberFindFirst.mockResolvedValue(first as never);
    const resolved = await getPrimaryOrganization(userId);
    expect(resolved.organizationId).toBe(organizationId);
    expect(resolved.role).toBe('VIEWER');
    expect(memberFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId }, orderBy: { createdAt: 'asc' } }));
  });

  it('returns safe organizations from the actual memberships in deterministic order', async () => {
    memberFindMany.mockResolvedValue([
      { role: 'MEMBER', organization: { id: organizationId, name: 'First', slug: 'first' } },
      { role: 'VIEWER', organization: { id: otherOrganizationId, name: 'Second', slug: 'second' } },
    ] as never);
    const response = await request(app).get('/api/v1/auth/me').set('Cookie', authCookie());
    expect(response.status).toBe(200);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.organizations.map((organization: { id: string }) => organization.id)).toEqual([organizationId, otherOrganizationId]);
    expect(memberFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId }, orderBy: { createdAt: 'asc' } }));
  });
});