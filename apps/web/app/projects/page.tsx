'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiClientError, apiRequest } from '../../lib/api';

type Organization = { id: string; name: string; role: string };
type Project = { id: string; name: string; slug: string; description: string | null };
type Session = { organizations: Organization[] };

export default function ProjectsPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const session = await apiRequest<Session>('/auth/me');
      const currentOrganization = session.organizations[0];
      if (!currentOrganization) throw new Error('No organization membership is available for this account.');
      setOrganization(currentOrganization);
      setProjects(await apiRequest<Project[]>(`/organizations/${currentOrganization.id}/projects`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load projects');
      if (requestError instanceof ApiClientError && requestError.status === 401) router.replace('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization) return;
    setError('');
    try {
      await apiRequest(`/organizations/${organization.id}/projects`, { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', slug: '', description: '' });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create project');
    }
  };

  const remove = async (project: Project) => {
    if (!organization || !window.confirm(`Delete ${project.name}? This is blocked when historical resources exist.`)) return;
    try {
      await apiRequest(`/organizations/${organization.id}/projects/${project.id}`, { method: 'DELETE' });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete project');
    }
  };

  if (loading) return <main className="page-shell"><p>Loading projects...</p></main>;

  return (
    <main className="page-shell">
      <header className="page-header"><div><Link href="/dashboard" className="eyebrow">OpsPilot AI</Link><h1>Projects</h1><p>{organization?.name}</p></div><Link href="/dashboard" className="button secondary">Dashboard</Link></header>
      {error && <p className="alert" role="alert">{error}</p>}
      <section className="panel"><h2>Create project</h2><form onSubmit={create} className="form-grid"><input required placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /><input placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><button className="button" type="submit">Create project</button></form></section>
      <section className="stack"><h2 className="section-title">Your projects</h2>{projects.length === 0 ? <div className="empty">No projects yet.</div> : projects.map((project) => <article className="list-row" key={project.id}><div><Link href={`/project/${project.id}`} className="row-title">{project.name}</Link><p>{project.slug}{project.description ? ` · ${project.description}` : ''}</p></div><button className="button danger" onClick={() => void remove(project)}>Delete</button></article>)}</section>
    </main>
  );
}
