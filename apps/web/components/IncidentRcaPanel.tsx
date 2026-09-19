'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type Evidence = { type: 'event' | 'deployment' | 'history' | 'metric'; id: string; reason: string };
type Recommendation = { action: string; reason: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' };
type AlternativeCause = { cause: string; confidence: number };
type Analysis = { rootCause: string; confidence: number; summary: string; evidence: Evidence[]; recommendations: Recommendation[]; alternativeCauses: AlternativeCause[]; model: string; modelVersion: string | null; promptVersion: string | null; createdAt: string };

export default function IncidentRcaPanel({ incidentId, canAnalyze }: { incidentId: string; canAnalyze: boolean }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try { setAnalysis(await apiRequest<Analysis | null>(`/incidents/${incidentId}/ai/root-cause`)); }
      catch { setError('AI analysis is temporarily unavailable.'); }
    };
    void load();
  }, [incidentId]);

  const analyze = async () => {
    setLoading(true); setError('');
    try { setAnalysis(await apiRequest<Analysis>(`/incidents/${incidentId}/ai/root-cause`, { method: 'POST' })); }
    catch { setError('AI analysis is temporarily unavailable.'); }
    finally { setLoading(false); }
  };

  return <section className="panel rca-panel"><div className="section-heading"><div><p className="eyebrow">AI enrichment</p><h2>AI Root Cause Analysis</h2></div>{canAnalyze && <button className="button" disabled={loading} onClick={() => void analyze()}>{loading ? 'Analyzing context...' : analysis ? 'Regenerate analysis' : 'Analyze incident'}</button>}</div>{error && <p className="alert" role="alert">{error}</p>}{loading && <p className="muted" role="status">Analyzing incident context...</p>}{!loading && !analysis && !error && <p className="muted">No AI analysis has been generated for this incident.</p>}{analysis && !loading && <div className="rca-content"><div><p className="eyebrow">Likely root cause</p><h3>{analysis.rootCause}</h3><p className="prose">{analysis.summary}</p><p className="muted">AI confidence: {Math.round(analysis.confidence * 100)}% · {new Date(analysis.createdAt).toLocaleString()} · {analysis.model}</p></div><div><p className="eyebrow">Observed evidence</p><ul className="rca-list">{analysis.evidence.map((item) => <li key={`${item.type}-${item.id}`}><a href={`#${item.type}-${item.id}`}>{item.type}: {item.id}</a><span>{item.reason}</span></li>)}</ul></div><div><p className="eyebrow">Recommended actions</p><ul className="rca-list">{analysis.recommendations.map((item) => <li key={item.action}><strong>{item.priority}</strong><span>{item.action} {item.reason}</span></li>)}</ul></div>{analysis.alternativeCauses.length > 0 && <div><p className="eyebrow">Alternative causes</p><ul className="rca-list">{analysis.alternativeCauses.map((item) => <li key={item.cause}><span>{item.cause}</span><small>{Math.round(item.confidence * 100)}% confidence</small></li>)}</ul></div>}</div>}</section>;
}