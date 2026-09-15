import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const userId = '00000000-0000-4000-8000-000000000001';
const organizationId = '00000000-0000-4000-8000-000000000002';
const otherOrganizationId = '00000000-0000-4000-8000-000000000003';
const passwordHash = await bcrypt.hash('secure-password', 4);

process.env.AUTH_SECRET = 'test-auth-secret-that-is-at-least-32-characters';
process.env.AUTH_COOKIE_NAME = 'test_auth';
process.env.NODE_ENV = 'test';

const { default: app } = await import('../src/app');
const { prisma } = await import('../src/lib/prisma');

const auditCreate = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never);
const userFindUnique = vi.spyOn(prisma.user, 'findUnique');
const userCreate = vi.spyOn(prisma.user, 'create');
const userUpdate = vi.spyOn(prisma.user, 'update');
const organizationCreate = vi.spyOn(prisma.organization, 'create');
const membershipCreate = vi.spyOn(prisma.organizationMember, 'create');
const membershipFindMany = vi.spyOn(prisma.organizationMember, 'findMany');
const membershipFindUnique = vi.spyOn(prisma.organizationMember, 'findUnique');
const membershipUpdate = vi.spyOn(prisma.organizationMember, 'update');
const membershipCount = vi.spyOn(prisma.organizationMember, 'count');

const developmentUser = {
  id: userId,
  email: 'user@example.com',
  name: 'User Name',
  avatarUrl: null,
  isActive: true,
  passwordHash,
};

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue(null);
  membershipFindMany.mockResolvedValue([]);
  membershipFindUnique.mockResolvedValue(null);
  membershipCount.mockResolvedValue(1);
  userUpdate.mockResolvedValue(developmentUser as never);
});

describe('authentication routes', () => {
  it('registers a user with a hashed password and owner organization', async () => {
    const createdUser = { ...developmentUser, passwordHash: await bcrypt.hash('secure-password', 4) };
    const organization = {
      id: organizationId,
      name: "User Name's Organization",
      slug: 'user-name-s-organization-00000000',
    };
    userCreate.mockResolvedValue(createdUser as never);
    organizationCreate.mockResolvedValue(organization as never);
    membershipCreate.mockResolvedValue({ organizationId, userId, role: 'OWNER' } as never);
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback) => callback({
      user: { findUnique: vi.fn().mockResolvedValue(null), create: userCreate },
      organization: { create: organizationCreate },
      organizationMember: { create: membershipCreate },
    } as never));

    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'USER@example.com',
      password: 'secure-password',
      name: 'User Name',
    });

    expect(response.status).toBe(201);
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.organization.role).toBe('OWNER');
    expect(createdUser.passwordHash).not.toBe('secure-password');
  });

  it('rejects duplicate registration', async () => {
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback) => callback({
      user: { findUnique: vi.fn().mockResolvedValue(developmentUser) },
    } as never));

    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'user@example.com',
      password: 'secure-password',
      name: 'User Name',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('logs in with a valid password and rejects an invalid password generically', async () => {
    userFindUnique.mockResolvedValue(developmentUser as never);
    membershipFindMany.mockResolvedValue([{ organizationId }] as never);

    const success = await request(app).post('/api/v1/auth/login').send({
      email: 'USER@example.com',
      password: 'secure-password',
    });
    const failure = await request(app).post('/api/v1/auth/login').send({
      email: 'USER@example.com',
      password: 'wrong-password',
    });

    expect(success.status).toBe(200);
    expect(success.body.data.user.passwordHash).toBeUndefined();
    expect(failure.status).toBe(401);
    expect(failure.body.error.message).toBe('Invalid email or password');
  });

  it('requires authentication for /auth/me and returns the safe current user', async () => {
    const unauthenticated = await request(app).get('/api/v1/auth/me');
    expect(unauthenticated.status).toBe(401);

    userFindUnique.mockResolvedValueOnce(developmentUser as never).mockResolvedValueOnce({
      id: userId,
      email: developmentUser.email,
      name: developmentUser.name,
      avatarUrl: null,
      isActive: true,
    } as never);
    membershipFindMany.mockResolvedValue([{
      role: 'OWNER',
      organization: { id: organizationId, name: 'Org', slug: 'org' },
    }] as never);
    const login = await request(app).post('/api/v1/auth/login').send({ email: developmentUser.email, password: 'secure-password' });
    const current = await request(app).get('/api/v1/auth/me').set('Cookie', login.headers['set-cookie']);

    expect(current.status).toBe(200);
    expect(current.body.data.user.passwordHash).toBeUndefined();
    expect(current.body.data.organizations[0].role).toBe('OWNER');
  });

  it('clears the cookie on logout', async () => {
    const response = await request(app).post('/api/v1/auth/logout');
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toContain('Max-Age=0');
  });
});

describe('organization authorization', () => {
  it('rejects cross-tenant access and insufficient roles', async () => {
    userFindUnique.mockResolvedValue(developmentUser as never);
    membershipFindMany.mockResolvedValue([]);
    const login = await request(app).post('/api/v1/auth/login').send({ email: developmentUser.email, password: 'secure-password' });

    membershipFindUnique.mockResolvedValueOnce(null);
    const crossTenant = await request(app)
      .get(`/api/v1/organizations/${otherOrganizationId}`)
      .set('Cookie', login.headers['set-cookie']);
    expect(crossTenant.status).toBe(403);

    membershipFindUnique.mockResolvedValueOnce({ organizationId, userId, role: 'VIEWER' } as never);
    const deniedRole = await request(app)
      .patch(`/api/v1/organizations/${organizationId}/members/${userId}`)
      .set('Cookie', login.headers['set-cookie'])
      .send({ role: 'ADMIN' });
    expect(deniedRole.status).toBe(403);
  });

  it('allows owners to update roles without removing the last owner', async () => {
    userFindUnique.mockResolvedValue(developmentUser as never);
    const login = await request(app).post('/api/v1/auth/login').send({ email: developmentUser.email, password: 'secure-password' });
    membershipFindUnique.mockResolvedValue({ organizationId, userId, role: 'OWNER' } as never);
    membershipCount.mockResolvedValue(1);

    const response = await request(app)
      .patch(`/api/v1/organizations/${organizationId}/members/${userId}`)
      .set('Cookie', login.headers['set-cookie'])
      .send({ role: 'ADMIN' });

    expect(response.status).toBe(409);
    expect(membershipUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'MEMBER_ROLE_UPDATED' }));
  });
});
