'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { apiRequest } from '../../../../../lib/api';

type Organization = { id: string; name: string; role: string };
type Session = { organizations: Organization[] };
type Service = { id: string; name: string; slug: string; description: string | null };
type Environment = { id: string; name: string };
type ApiKey = { id: string; name: string; keyPrefix: string; revokedAt: string | null; expiresAt: string | null };

export default function ServicePage() {
  const { projectId, serviceId } = useParams<{ projectId: string; serviceId: string }>();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [keys, setKeys] = useState<Record<string, ApiKey[]>>({});
  const [environmentName, setEnvironmentName] = useState('');
  const [keyName, setKeyName] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  const base = organization ? `/organizations/${organization.id}/projects/${projectId}/services/${serviceId}` : '';
  const load = useCallback(async () => {
    try {
      const session = await apiRequest<Session>('/auth/me');
      const currentOrganization = session.organizations[0];
      if (!currentOrganization) throw new Error('No organization is available');
      setOrganization(currentOrganization);
      const [loadedService, loadedEnvironments] = await Promise.all([apiRequest<Service>(`${`/organizations/${currentOrganization.id}/projects/${projectId}/services/${serviceId}`}`), apiRequest<Environment[]>(`/organizations/${currentOrganization.id}/projects/${projectId}/services/${serviceId}/environments`)]);
      setService(loadedService); setEnvironments(loadedEnvironments);
      const loadedKeys = await Promise.all(loadedEnvironments.map(async (environment) => [environment.id, await apiRequest<ApiKey[]>(`/organizations/${currentOrganization.id}/projects/${projectId}/services/${serviceId}/environments/${environment.id}/api-keys`)] as const));
      setKeys(Object.fromEntries(loadedKeys));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load service'); }
  }, [projectId, serviceId]);
  useEffect(() => { void load(); }, [load]);

  const createEnvironment = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await apiRequest(`${base}/environments`, { method: 'POST', body: JSON.stringify({ name: environmentName }) }); setEnvironmentName(''); await load(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to create environment'); } };
  const createKey = async (event: FormEvent<HTMLFormElement>, environmentId: string) => { event.preventDefault(); try { const result = await apiRequest<{ apiKey: ApiKey; secret: string }>(`${base}/environments/${environmentId}/api-keys`, { method: 'POST', body: JSON.stringify({ name: keyName }) }); setSecret(result.secret); setKeyName(''); await load(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to create API key'); } };
  const revoke = async (environmentId: string, apiKeyId: string) => { if (!window.confirm('Revoke this API key?')) return; try { await apiRequest(`${base}/environments/${environmentId}/api-keys/${apiKeyId}/revoke`, { method: 'POST' }); await load(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to revoke API key'); } };
  const rotate = async (environmentId: string, apiKeyId: string) => { if (!window.confirm('Rotate this API key? The old key will stop working.')) return; try { const result = await apiRequest<{ apiKey: ApiKey; secret: string }>(`${base}/environments/${environmentId}/api-keys/${apiKeyId}/rotate`, { method: 'POST' }); setSecret(result.secret); await load(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to rotate API key'); } };

  return <main className="page-shell"><header className="page-header"><div><Link href={`/project/${projectId}`} className="eyebrow">Project services</Link><h1>{service?.name || 'Service'}</h1><p>{service?.description || service?.slug}</p></div></header>{error && <p className="alert">{error}</p>}{secret && <section className="secret-box"><strong>The secret will only be shown once. Copy it now.</strong><code>{secret}</code><button className="button" onClick={() => void navigator.clipboard.writeText(secret)}>Copy secret</button><button className="text-button" onClick={() => setSecret('')}>Dismiss</button></section>}<section className="panel"><h2>Add environment</h2><form onSubmit={createEnvironment} className="inline-form"><input required placeholder="production, preview, qa..." value={environmentName} onChange={(event) => setEnvironmentName(event.target.value)} /><button className="button" type="submit">Add</button></form></section><section className="stack"><h2 className="section-title">Environments and API keys</h2>{environments.map((environment) => <article className="panel" key={environment.id}><div className="row-heading"><h3>{environment.name}</h3></div><form onSubmit={(event) => void createKey(event, environment.id)} className="inline-form"><input required placeholder="New key name" value={keyName} onChange={(event) => setKeyName(event.target.value)} /><button className="button" type="submit">Create API key</button></form>{(keys[environment.id] || []).map((apiKey) => <div className="key-row" key={apiKey.id}><span><strong>{apiKey.name}</strong><small>{apiKey.keyPrefix} {apiKey.revokedAt ? '· revoked' : ''}</small></span><span><button className="text-button" disabled={Boolean(apiKey.revokedAt)} onClick={() => void rotate(environment.id, apiKey.id)}>Rotate</button><button className="text-button danger-text" disabled={Boolean(apiKey.revokedAt)} onClick={() => void revoke(environment.id, apiKey.id)}>Revoke</button></span></div>)}</article>)}</section></main>;
}
