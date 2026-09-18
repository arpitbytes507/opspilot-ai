'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '../../../components/AppShell';
import { apiRequest } from '../../../lib/api';

type Incident = { id: string; title: string; description: string | null; status: string; severity: string; detectedAt: string; service: { name: string }; serviceEnvironment: { name: string }; assignedTo: { id: string; name: string } | null };
type Event = { id: string; type: string; level: string; message: string; source: string; timestamp: string; traceId: string | null };
type Deployment = { id: string; version: string; commitSha: string | null; status: string; startedAt: string; deployedBy: { name: string } | null };
type Organization = { id: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' };
type Session = { organizations: Organization[] };
type Member = { userId: string; role: Organization['role']; user: { id: string; email: string; name: string; isActive: boolean } };
const transitions = ['DETECTED', 'OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'POSTMORTEM'];

export default function IncidentPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [role, setRole] = useState<Organization['role'] | null>(null);
  const [error, setError] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const canEdit = role !== null && role !== 'VIEWER';

  useEffect(() => {
    const load = async () => {
      try {
        const [loaded, loadedEvents, loadedDeployments, session] = await Promise.all([
          apiRequest<Incident>(`/incidents/${incidentId}`),
          apiRequest<Event[]>(`/incidents/${incidentId}/events`),
          apiRequest<Deployment[]>(`/incidents/${incidentId}/deployments`),
          apiRequest<Session>('/auth/me'),
        ]);
        const organization = session.organizations[0];
        if (!organization) throw new Error('No organization is available');
        const loadedMembers = await apiRequest<Member[]>(`/organizations/${organization.id}/members`);
        setIncident(loaded);
        setEvents(loadedEvents);
        setDeployments(loadedDeployments);
        setOrganizationId(organization.id);
        setRole(organization.role);
        setMembers(loadedMembers);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load incident');
      }
    };
    void load();
  }, [incidentId]);

  const update = async (changes: Record<string, string | null>, message?: string) => {
    setSaving(true);
    setError('');
    setAssignmentError('');
    setSuccess('');
    try {
      await apiRequest<Incident>(`/incidents/${incidentId}`, { method: 'PATCH', body: JSON.stringify(changes) });
      const persisted = await apiRequest<Incident>(`/incidents/${incidentId}`);
      setIncident(persisted);
      if (message) setSuccess(message);
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : 'Unable to update incident';
      if ('assignedToUserId' in changes) setAssignmentError(messageText);
      else setError(messageText);
    } finally {
      setSaving(false);
    }
  };

  const assign = (userId: string) => void update({ assignedToUserId: userId || null }, userId ? 'Incident assigned.' : 'Incident unassigned.');

  return <AppShell title={incident?.title || 'Incident'} eyebrow="Incident detail"><Link href="/incidents" className="back-link">← All incidents</Link>{error && <p className="alert" role="alert">{error}</p>}{success && <p className="success" role="status">{success}</p>}{incident ? <><section className="incident-header panel"><div><div className="incident-tags"><span className={`severity severity-${incident.severity.toLowerCase()}`}>{incident.severity}</span><span className="status-chip">{incident.status}</span></div><h2>{incident.title}</h2><p>{incident.service.name} · {incident.serviceEnvironment.name} · detected {new Date(incident.detectedAt).toLocaleString()}</p></div><div className="action-group"><select disabled={saving || !canEdit} value={incident.status} onChange={(event) => void update({ status: event.target.value })}>{transitions.map((value) => <option key={value}>{value}</option>)}</select><select disabled={saving || !canEdit} value={incident.severity} onChange={(event) => void update({ severity: event.target.value })}><option>P1</option><option>P2</option><option>P3</option><option>P4</option></select></div></section><div className="detail-grid"><section className="panel"><p className="eyebrow">Description</p><p className="prose">{incident.description || 'No description was recorded for this incident.'}</p><p className="eyebrow section-gap">Root cause</p><p className="muted">AI analysis not available yet.</p><p className="eyebrow section-gap">Assignment</p><p>{incident.assignedTo?.name || 'Unassigned'}</p></section><section className="panel"><p className="eyebrow">Incident details</p><div className="key-row"><span>Assignee</span>{canEdit ? <select aria-label="Incident assignee" disabled={saving || !organizationId || members.length === 0} value={incident.assignedTo?.id || ''} onChange={(event) => assign(event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.user.name} ({member.user.email})</option>)}</select> : <strong>{incident.assignedTo?.name || 'Unassigned'}</strong>}</div>{assignmentError && <p className="field-error" role="alert">{assignmentError}</p>}{!members.length && canEdit && organizationId && <p className="muted">No active organization members are available.</p>}<div className="key-row"><span>Detected</span><strong>{new Date(incident.detectedAt).toLocaleString()}</strong></div></section></div><section className="panel"><div className="section-heading"><div><p className="eyebrow">Correlation</p><h2>Events</h2></div></div>{events.length ? <div className="event-list">{events.map((event) => <div className="event-item" key={event.id}><span className="event-type">{event.type}</span><div><strong>{event.message}</strong><small>{event.level} · {event.source} · {new Date(event.timestamp).toLocaleString()}{event.traceId ? ` · trace ${event.traceId}` : ''}</small></div></div>)}</div> : <div className="empty">No correlated events.</div>}</section><section className="panel"><p className="eyebrow">Deployment context</p>{deployments.length ? <div className="event-list">{deployments.map((deployment) => <div className="event-item" key={deployment.id}><span className="event-type">{deployment.status}</span><div><strong>{deployment.version}</strong><small>{deployment.commitSha || 'No commit SHA'} · {deployment.deployedBy?.name || 'Unknown'} · {new Date(deployment.startedAt).toLocaleString()}</small></div></div>)}</div> : <div className="empty">No deployments found before detection.</div>}</section></> : <div className="panel">{error || 'Loading incident...'}</div>}</AppShell>;
}
