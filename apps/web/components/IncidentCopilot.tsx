'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../lib/api';

type ObservedFact = { fact: string; evidenceIds: string[] };
type Inference = { inference: string; confidence: number; evidenceIds: string[] };
type Recommendation = { action: string; reason: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' };
type CopilotResponse = {
  answer: string;
  confidence: number;
  observedFacts: ObservedFact[];
  inferences: Inference[];
  recommendedActions: Recommendation[];
  followUpQuestions: string[];
};
type CopilotMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  structuredResponse: CopilotResponse | null;
  createdAt: string;
};
type CopilotHistory = { conversationId: string | null; messages: CopilotMessage[] };
type CopilotPostResponse = CopilotResponse & {
  userMessageId: string;
  assistantMessageId?: string;
};

const errorMessage = (error: unknown, loadingHistory: boolean): string => {
  if (!(error instanceof ApiClientError)) return loadingHistory ? 'Unable to load Copilot conversation.' : 'Unable to reach OpsPilot. Check your connection and try again.';
  if (error.status === 401) return 'Your session has expired. Sign in again to continue.';
  if (error.status === 403) return loadingHistory ? 'You do not have permission to view this Copilot conversation.' : 'You do not have permission to use Copilot for this incident.';
  if (error.status === 404) return 'This incident could not be found or is no longer available.';
  if (error.status === 429) return loadingHistory ? 'Copilot history is temporarily rate limited.' : 'Copilot is receiving too many requests. Wait a moment and try again.';
  if (error.status >= 500) return loadingHistory ? 'Copilot history is temporarily unavailable.' : 'Copilot is temporarily unavailable. Try again shortly.';
  return loadingHistory ? 'Copilot history could not be loaded.' : 'Copilot could not process that question. Check it and try again.';
};

export default function IncidentCopilot({ incidentId, canAnalyze }: { incidentId: string; canAnalyze: boolean }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setQuestion('');
    setMessages([]);
    setError('');
    setLoadingHistory(true);
    void apiRequest<CopilotHistory>(`/incidents/${incidentId}/ai/copilot`)
      .then((history) => {
        if (active) setMessages(history.messages);
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError, true));
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => { active = false; };
  }, [incidentId]);

  const ask = async (rawQuestion: string) => {
    const message = rawQuestion.trim();
    if (!message) {
      setError('Enter a question before asking Copilot.');
      return;
    }
    if (!canAnalyze || asking || loadingHistory) return;

    setError('');
    setAsking(true);
    try {
      const response = await apiRequest<CopilotPostResponse>(`/incidents/${incidentId}/ai/copilot`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      const createdAt = new Date().toISOString();
      const { userMessageId, assistantMessageId, ...structuredResponse } = response;
      setMessages((current) => [...current,
        { id: userMessageId, role: 'USER', content: message, structuredResponse: null, createdAt },
        { id: assistantMessageId || `${Date.now()}-assistant`, role: 'ASSISTANT', content: response.answer, structuredResponse, createdAt },
      ]);
      setQuestion('');
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, false));
    } finally {
      setAsking(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(question);
  };

  return (
    <section className="panel copilot-panel" aria-labelledby="copilot-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Incident intelligence</p>
          <h2 id="copilot-title">AI Incident Copilot</h2>
        </div>
        <span className="copilot-status">{loadingHistory ? 'LOADING HISTORY' : asking ? 'ANALYZING' : 'READY'}</span>
      </div>

      {loadingHistory && <p className="muted copilot-loading" role="status">Loading saved conversation...</p>}
      {!loadingHistory && messages.length === 0 && !error && (
        <p className="muted copilot-empty">No conversation yet. Ask a question about the incident, its evidence, or next steps.</p>
      )}

      {!loadingHistory && messages.length > 0 && (
        <div className="copilot-thread" aria-live="polite">
          {messages.map((message) => {
            if (message.role === 'USER') {
              return (
                <div className="copilot-question" key={message.id}>
                  <span className="copilot-speaker">YOU</span>
                  <p>{message.content}</p>
                </div>
              );
            }

            const response = message.structuredResponse;
            const answer = response?.answer || message.content;
            const confidence = response ? Math.round(Math.max(0, Math.min(1, response.confidence)) * 100) : 0;
            return (
                <article className="copilot-exchange" key={message.id}>
                  <div className="copilot-answer">
                  <div className="copilot-answer-heading">
                    <span className="copilot-speaker">COPILOT</span>
                      {response && <span className="copilot-confidence">{confidence}% confidence</span>}
                  </div>
                  {response && <div className="copilot-confidence-track" role="progressbar" aria-label="Copilot confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={confidence}><span style={{ width: `${confidence}%` }} /></div>}
                  <p className="prose copilot-answer-text">{answer}</p>

                  {response && <div className="copilot-findings">
                    <section className="copilot-finding copilot-facts">
                      <h3>Observed facts</h3>
                      {response.observedFacts.length ? (
                        <ul>{response.observedFacts.map((item, index) => (
                          <li key={`${item.fact}-${index}`}>
                            <span>{item.fact}</span>
                            {item.evidenceIds.length > 0 && <small>Evidence: {item.evidenceIds.join(', ')}</small>}
                          </li>
                        ))}</ul>
                      ) : <p className="muted">No observed facts returned.</p>}
                    </section>

                    <section className="copilot-finding copilot-inferences">
                      <h3>Inferences</h3>
                      {response.inferences.length ? (
                        <ul>{response.inferences.map((item, index) => (
                          <li key={`${item.inference}-${index}`}>
                            <span>{item.inference}</span>
                            <small>{Math.round(item.confidence * 100)}% confidence{item.evidenceIds.length ? ` · Evidence: ${item.evidenceIds.join(', ')}` : ''}</small>
                          </li>
                        ))}</ul>
                      ) : <p className="muted">No inferences returned.</p>}
                    </section>

                    <section className="copilot-finding copilot-actions">
                      <h3>Recommended actions</h3>
                      {response.recommendedActions.length ? (
                        <ul>{response.recommendedActions.map((item, index) => (
                          <li key={`${item.action}-${index}`}>
                            <span className={`copilot-priority priority-${item.priority.toLowerCase()}`}>{item.priority}</span>
                            <div><strong>{item.action}</strong><small>{item.reason}</small></div>
                          </li>
                        ))}</ul>
                      ) : <p className="muted">No actions returned.</p>}
                    </section>
                  </div>}

                  {response && response.followUpQuestions.length > 0 && (
                    <div className="copilot-followups">
                      <h3>Follow-up questions</h3>
                      <div>{response.followUpQuestions.map((followUp, index) => (
                        <button className="copilot-followup" type="button" key={`${followUp}-${index}`} disabled={!canAnalyze || asking || loadingHistory} onClick={() => setQuestion(followUp)}>
                          {followUp}
                        </button>
                      ))}</div>
                    </div>
                  )}
                  </div>
              </article>
            );
          })}
        </div>
      )}

      {asking && <p className="muted copilot-loading" role="status">Reviewing incident context and recent conversation...</p>}
      {error && <p className="alert copilot-error" role="alert">{error}</p>}

      {canAnalyze ? (
        <form className="copilot-form" onSubmit={submit}>
          <label htmlFor="copilot-question">Ask about this incident</label>
          <textarea
            id="copilot-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="What evidence best explains the impact?"
            disabled={asking || loadingHistory}
          />
          <div className="copilot-form-footer">
            <span>{question.length}/2000</span>
            <button className="button" type="submit" disabled={asking || loadingHistory || !question.trim()}>
              {asking ? 'Asking Copilot...' : 'Ask Copilot'}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted copilot-permission">AI Copilot is available to incident members and above.</p>
      )}
    </section>
  );
}