'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { apiRequest } from '../../../lib/api';

type Organization = { id: string; name: string; role: string };
type Session = { organizations: Organization[] };
type Project = { id: string; name: string; slug: string; description: string | null };
type Service = { id: string; name: string; slug: string; description: string | null };

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const session = await apiRequest<Session>('/auth/me');
      const currentOrganization = session.organizations[0];
      if (!currentOrganization) throw new Error('No organization is available');
      setOrganization(currentOrganization);
      setProject(await apiRequest<Project>(`/organizations/${currentOrganization.id}/projects/${projectId}`));
      setServices(await apiRequest<Service[]>(`/organizations/${currentOrganization.id}/projects/${projectId}/services`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load project');
    }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization) return;
    try {
      await apiRequest(`/organizations/${organization.id}/projects/${projectId}/services`, { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', slug: '', description: '' });
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to create service'); }
  };

  const remove = async (service: Service) => {
    if (!organization || !window.confirm(`Delete ${service.name}? Historical dependencies will block this.`)) return;
    try { await apiRequest(`/organizations/${organization.id}/projects/${projectId}/services/${service.id}`, { method: 'DELETE' }); await load(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to delete service'); }
  };

  return <main className="page-shell"><header className="page-header"><div><Link href="/projects" className="eyebrow">Projects</Link><h1>{project?.name || 'Project'}</h1><p>{project?.description || project?.slug}</p></div><Link href="/projects" className="button secondary">All projects</Link></header>{error && <p className="alert">{error}</p>}<section className="panel"><h2>Add service</h2><form onSubmit={create} className="form-grid"><input required placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /><input placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><button className="button" type="submit">Create service</button></form></section><section className="stack"><h2 className="section-title">Services</h2>{services.length === 0 ? <div className="empty">No services yet.</div> : services.map((service) => <article className="list-row" key={service.id}><div><Link href={`/project/${projectId}/services/${service.id}`} className="row-title">{service.name}</Link><p>{service.slug}{service.description ? ` · ${service.description}` : ''}</p></div><button className="button danger" onClick={() => void remove(service)}>Delete</button></article>)}</section><button className="text-button" onClick={() => router.push('/projects')}>Back to projects</button></main>;
}
