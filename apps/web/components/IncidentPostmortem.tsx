'use client';

import { useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../lib/api';

type Postmortem = {
  analysisId: string;
  createdAt: string;
  title: string;
  summary: string;
  impact: { description: string; duration?: string | null };
  timeline: { timestamp: string; event: string; evidenceIds: string[] }[];
  rootCause: { description: string; confidence: number; evidenceIds: string[] };
  contributingFactors: { factor: string; evidenceIds: string[] }[];
  resolution: string[];
  prevention: { recommendation: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }[];
  lessonsLearned: string[];
  model?: string;
  modelVersion?: string | null;
  promptVersion?: string | null;
};

const errorMessage = (error: unknown): string => {
  if (!(error instanceof ApiClientError)) return 'Unable to reach OpsPilot. Check your connection and try again.';
  if (error.status === 401) return 'Your session has expired. Sign in again to continue.';
  if (error.status === 403) return 'You do not have permission to access this postmortem.';
  if (error.status === 404) return 'This incident could not be found or is no longer available.';
  if (error.status === 409) return 'Postmortems can only be generated for resolved incidents.';
  if (error.status === 422) return 'The postmortem request could not be validated.';
  if (error.status === 429) return 'Postmortem generation is rate limited. Wait a moment and try again.';
  if (error.status === 503 || error.status >= 500) return 'Postmortem generation is temporarily unavailable. Try again shortly.';
  return 'Unable to load or generate this postmortem.';
};

const evidenceText = (ids: string[]) => ids.length > 0 && <small>Evidence: {ids.join(', ')}</small>;

export default function IncidentPostmortem({ incidentId, canAnalyze }: { incidentId: string; canAnalyze: boolean }) {
  const [postmortems, setPostmortems] = useState<Postmortem[]>([]);
  const [incidentStatus, setIncidentStatus] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const canGenerate = incidentStatus === 'RESOLVED' && canAnalyze;

  useEffect(() => {
    let active = true;
    setPostmortems([]);
    setIncidentStatus(null);
    setError('');
    setLoadingHistory(true);
    void Promise.all([
      apiRequest<{ status: string }>(`/incidents/${incidentId}`),
      apiRequest<Postmortem | null>(`/incidents/${incidentId}/ai/postmortem`),
    ])
      .then(([incident, postmortem]) => {
        if (!active) return;
        setIncidentStatus(incident.status);
        if (postmortem) setPostmortems([postmortem]);
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => { active = false; };
  }, [incidentId]);

  const generate = async () => {
    if (!canGenerate || generating || loadingHistory) return;
    setError('');
    setGenerating(true);
    try {
      const postmortem = await apiRequest<Postmortem>(`/incidents/${incidentId}/ai/postmortem`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setPostmortems((current) => [...current, postmortem]);
    } catch (requestError: unknown) {
      setError(errorMessage(requestError));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="panel postmortem-panel" aria-labelledby="postmortem-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Incident review</p>
          <h2 id="postmortem-title">AI Postmortem</h2>
        </div>
        {canGenerate && (
          <button className="button" type="button" disabled={generating || loadingHistory} onClick={() => void generate()}>
            {generating ? 'Generating...' : 'Generate Postmortem'}
          </button>
        )}
      </div>

      {loadingHistory && <p className="muted postmortem-state" role="status">Loading saved postmortem...</p>}
      {error && <p className="alert postmortem-error" role="alert">{error}</p>}
      {!loadingHistory && !error && postmortems.length === 0 && (
        <p className="muted postmortem-state">
          {incidentStatus === 'RESOLVED' ? 'No postmortem has been generated for this incident.' : 'A postmortem is available after this incident is resolved.'}
        </p>
      )}
      {!canAnalyze && postmortems.length === 0 && incidentStatus === 'RESOLVED' && (
        <p className="muted postmortem-state">Postmortem generation is available to incident members and above.</p>
      )}
      {!loadingHistory && postmortems.length > 0 && (
        <div className="postmortem-history">
          {postmortems.map((postmortem, index) => (
            <article className="postmortem-record" key={postmortem.analysisId}>
              <header className="postmortem-record-heading">
                <div>
                  <p className="eyebrow">Postmortem {index + 1}</p>
                  <h3>{postmortem.title}</h3>
                </div>
                <time className="muted" dateTime={postmortem.createdAt}>{new Date(postmortem.createdAt).toLocaleString()}</time>
              </header>
              <section className="postmortem-section">
                <h4>Summary</h4>
                <p className="prose">{postmortem.summary}</p>
              </section>
              <section className="postmortem-section">
                <h4>Impact</h4>
                <p>{postmortem.impact.description}</p>
                {postmortem.impact.duration && <small>Duration: {postmortem.impact.duration}</small>}
              </section>
              <section className="postmortem-section">
                <h4>Timeline</h4>
                {postmortem.timeline.length ? <ol className="postmortem-timeline">{postmortem.timeline.map((entry, entryIndex) => (
                  <li key={`${entry.timestamp}-${entryIndex}`}>
                    <time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleString()}</time>
                    <span>{entry.event}</span>
                    {evidenceText(entry.evidenceIds)}
                  </li>
                ))}</ol> : <p className="muted">No timeline entries were returned.</p>}
              </section>
              <section className="postmortem-section">
                <h4>Root Cause</h4>
                <p>{postmortem.rootCause.description}</p>
                <small>{Math.round(postmortem.rootCause.confidence * 100)}% confidence</small>
                {evidenceText(postmortem.rootCause.evidenceIds)}
              </section>
              <section className="postmortem-section">
                <h4>Contributing Factors</h4>
                {postmortem.contributingFactors.length ? <ul>{postmortem.contributingFactors.map((factor, factorIndex) => <li key={`${factor.factor}-${factorIndex}`}>{factor.factor}{evidenceText(factor.evidenceIds)}</li>)}</ul> : <p className="muted">No contributing factors were returned.</p>}
              </section>
              <section className="postmortem-section">
                <h4>Resolution</h4>
                {postmortem.resolution.length ? <ul>{postmortem.resolution.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}</ul> : <p className="muted">No resolution steps were returned.</p>}
              </section>
              <section className="postmortem-section">
                <h4>Prevention</h4>
                {postmortem.prevention.length ? <ul>{postmortem.prevention.map((item, itemIndex) => <li key={`${item.recommendation}-${itemIndex}`}><span className={`copilot-priority priority-${item.priority.toLowerCase()}`}>{item.priority}</span> {item.recommendation}</li>)}</ul> : <p className="muted">No prevention recommendations were returned.</p>}
              </section>
              <section className="postmortem-section">
                <h4>Lessons Learned</h4>
                {postmortem.lessonsLearned.length ? <ul>{postmortem.lessonsLearned.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}</ul> : <p className="muted">No lessons were returned.</p>}
              </section>
            </article>
          ))}
        </div>
      )}
      {canAnalyze && incidentStatus !== 'RESOLVED' && postmortems.length > 0 && <p className="muted postmortem-state">Generation is available while the incident is RESOLVED.</p>}
    </section>
  );
}