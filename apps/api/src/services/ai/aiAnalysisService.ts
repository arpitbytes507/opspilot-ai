import { z } from 'zod';

import { config } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { recordAuditLog } from '../auditService';
import { HttpError } from '../../utils/httpError';
import { buildIncidentContext } from './incidentContextService';

const evidenceSchema = z.object({ type: z.enum(['event', 'deployment', 'history', 'metric']), id: z.string().max(200), reason: z.string().min(1).max(1000) });
const recommendationSchema = z.object({ action: z.string().min(1).max(1000), reason: z.string().min(1).max(1000), priority: z.enum(['HIGH', 'MEDIUM', 'LOW']) });
const rootCauseResponseSchema = z.object({
  analysisType: z.literal('ROOT_CAUSE'),
  rootCause: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(4000),
  evidence: z.array(evidenceSchema).max(20),
  recommendations: z.array(recommendationSchema).max(20),
  alternativeCauses: z.array(z.object({ cause: z.string().min(1).max(1000), confidence: z.number().min(0).max(1) })).max(10),
  model: z.string().max(200),
  modelVersion: z.string().max(200).nullable().optional(),
  promptVersion: z.string().max(50),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
});

const copilotResponseSchema = z.object({
  answer: z.string().min(1).max(8000),
  confidence: z.number().min(0).max(1),
  observedFacts: z.array(z.object({ fact: z.string().min(1).max(2000), evidenceIds: z.array(z.string().max(200)).max(20) })).max(20),
  inferences: z.array(z.object({ inference: z.string().min(1).max(2000), confidence: z.number().min(0).max(1), evidenceIds: z.array(z.string().max(200)).max(20) })).max(20),
  recommendedActions: z.array(z.object({ action: z.string().min(1).max(1000), reason: z.string().min(1).max(1000), priority: z.enum(['HIGH', 'MEDIUM', 'LOW']) })).max(20),
  followUpQuestions: z.array(z.string().min(1).max(300)).max(10),
});

const postmortemResponseSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(4000),
  impact: z.object({ description: z.string().min(1).max(2000), duration: z.string().max(200).nullable().optional() }),
  timeline: z.array(z.object({ timestamp: z.string().min(1).max(50), event: z.string().min(1).max(500), evidenceIds: z.array(z.string().max(200)).max(20) })).max(40),
  rootCause: z.object({ description: z.string().min(1).max(2000), confidence: z.number().min(0).max(1), evidenceIds: z.array(z.string().max(200)).max(20) }),
  contributingFactors: z.array(z.object({ factor: z.string().min(1).max(1000), evidenceIds: z.array(z.string().max(200)).max(20) })).max(20),
  resolution: z.array(z.string().min(1).max(1000)).max(10),
  prevention: z.array(z.object({ recommendation: z.string().min(1).max(1000), priority: z.enum(['HIGH', 'MEDIUM', 'LOW']) })).max(20),
  lessonsLearned: z.array(z.string().min(1).max(1000)).max(10),
  model: z.string().min(1).max(200).optional(),
  modelVersion: z.string().max(200).nullable().optional(),
  promptVersion: z.string().max(50).optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
});

const sanitizeError = (error: unknown, fallbackCode: string): HttpError => {
  if (error instanceof HttpError) return error;
  return new HttpError(503, fallbackCode, 'AI service unavailable');
};

const callAIService = async <T>(analysisType: 'ROOT_CAUSE' | 'COPILOT' | 'POSTMORTEM', context: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.aiRequestTimeoutMs);

  try {
    const response = await fetch(`${config.aiServiceUrl}/analyze/incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AI-Service-Key': config.aiServiceSecret },
      body: JSON.stringify({ analysisType, ...context }),
      signal: controller.signal,
    });

    const body = await response.json();
    if (!response.ok) {
      throw sanitizeError(new Error(`AI service returned ${response.status}`), 'AI_SERVICE_UNAVAILABLE');
    }

    return schema.parse(body);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error('AI response validation failed:', JSON.stringify(error.issues, null, 2));
      throw new HttpError(502, 'AI_ANALYSIS_INVALID_RESPONSE', 'AI analysis returned an invalid response');
    }
    if (error instanceof HttpError) throw error;
    console.error('AI request failed:', error);
    throw sanitizeError(error, analysisType === 'POSTMORTEM' ? 'AI_POSTMORTEM_UNAVAILABLE' : analysisType === 'COPILOT' ? 'AI_COPILOT_UNAVAILABLE' : 'AI_ANALYSIS_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
};

const formatAnalysis = (analysis: { evidence: unknown; recommendations: unknown; rootCause: string | null; confidence: number | null; model: string; modelVersion: string | null; promptVersion: string | null; inputTokens: number | null; outputTokens: number | null; processingTimeMs: number | null; createdAt: Date; updatedAt: Date }) => {
  const evidence = (analysis.evidence && typeof analysis.evidence === 'object' ? analysis.evidence : {}) as { summary?: string; items?: unknown[]; alternativeCauses?: unknown[] };
  return { ...analysis, summary: evidence.summary || '', evidence: evidence.items || [], alternativeCauses: evidence.alternativeCauses || [], recommendations: analysis.recommendations || [] };
};

export const getLatestRootCauseAnalysis = async (incidentId: string, organizationId: string) => {
  const incident = await prisma.incident.findFirst({ where: { id: incidentId, organizationId }, select: { id: true } });
  if (!incident) throw new HttpError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  const analysis = await prisma.aIAnalysis.findFirst({ where: { incidentId, organizationId, analysisType: 'ROOT_CAUSE' }, orderBy: { createdAt: 'desc' } });
  return analysis ? formatAnalysis(analysis) : null;
};

export const createRootCauseAnalysis = async (incidentId: string, organizationId: string) => {
  const context = await buildIncidentContext(incidentId, organizationId);
  if (!context) throw new HttpError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  const startedAt = Date.now();
  const result = await callAIService('ROOT_CAUSE', context, rootCauseResponseSchema);
  const analysis = await prisma.aIAnalysis.create({
    data: {
      organizationId,
      incidentId,
      analysisType: 'ROOT_CAUSE',
      rootCause: result.rootCause,
      confidence: result.confidence,
      evidence: { summary: result.summary, items: result.evidence, alternativeCauses: result.alternativeCauses },
      recommendations: result.recommendations,
      model: result.model,
      modelVersion: result.modelVersion,
      promptVersion: result.promptVersion,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      processingTimeMs: Date.now() - startedAt,
    },
  });
  return formatAnalysis(analysis);
};

export const queryIncidentCopilot = async (incidentId: string, organizationId: string, userId: string, message: string) => {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, organizationId },
    select: { id: true, title: true, description: true, status: true, severity: true, detectedAt: true, startedAt: true, mitigatedAt: true, resolvedAt: true, service: { select: { id: true, name: true, description: true } }, serviceEnvironment: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
  });
  if (!incident) throw new HttpError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');

  const context = await buildIncidentContext(incidentId, organizationId);
  const conversation = await prisma.aIConversation.upsert({
    where: { incidentId_userId: { incidentId, userId } },
    create: { organizationId, incidentId, userId },
    update: {},
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });

  const recentMessages = conversation.messages.slice().reverse().map((entry) => ({ role: entry.role, content: entry.content }));
  const userMessage = await prisma.aIConversationMessage.create({ data: { conversationId: conversation.id, role: 'USER', content: message } });
  const result = await callAIService('COPILOT', { ...context, message, conversation: recentMessages }, copilotResponseSchema);

  const assistantMessage = await prisma.aIConversationMessage.create({
    data: { conversationId: conversation.id, role: 'ASSISTANT', content: result.answer, structuredResponse: result },
  });

  await recordAuditLog({ organizationId, userId, action: 'AI_COPILOT_QUERY', resourceType: 'INCIDENT', resourceId: incidentId, metadata: { message: message.slice(0, 300), incidentId } });

  return {
    ...result,
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
  };
};

export const getIncidentCopilotConversation = async (incidentId: string, organizationId: string, userId: string) => {
  const incident = await prisma.incident.findFirst({ where: { id: incidentId, organizationId }, select: { id: true } });
  if (!incident) throw new HttpError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');

  const conversation = await prisma.aIConversation.findFirst({
    where: { incidentId, organizationId, userId },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true, structuredResponse: true, createdAt: true },
      },
    },
  });

  return conversation ? { conversationId: conversation.id, messages: conversation.messages } : { conversationId: null, messages: [] };
};

export const generateIncidentPostmortem = async (incidentId: string, organizationId: string) => {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, organizationId },
    select: { id: true, status: true, resolvedAt: true, detectedAt: true },
  });
  if (!incident) throw new HttpError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  if (incident.status !== 'RESOLVED' && incident.status !== 'POSTMORTEM') {
    throw new HttpError(409, 'INCIDENT_NOT_RESOLVED', 'Postmortem generation is only available for resolved incidents');
  }

  const context = await buildIncidentContext(incidentId, organizationId);
  if (!context) throw new HttpError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');

  const startedAt = Date.now();
  const result = await callAIService('POSTMORTEM', { ...context, status: incident.status, resolvedAt: incident.resolvedAt }, postmortemResponseSchema);

  const analysis = await prisma.aIAnalysis.create({
    data: {
      organizationId,
      incidentId,
      analysisType: 'POSTMORTEM',
      rootCause: result.rootCause.description,
      confidence: result.rootCause.confidence,
      evidence: result,
      recommendations: result.prevention,
      model: result.model ?? 'ai-service',
      modelVersion: result.modelVersion ?? 'v1',
      promptVersion: result.promptVersion ?? config.aiPromptVersions.postmortem,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      processingTimeMs: Date.now() - startedAt,
    },
  });

  await recordAuditLog({ organizationId, action: 'AI_POSTMORTEM_GENERATED', resourceType: 'INCIDENT', resourceId: incidentId, metadata: { postmortemId: analysis.id } });
  return { ...result, analysisId: analysis.id, createdAt: analysis.createdAt };
};

export const getLatestPostmortem = async (incidentId: string, organizationId: string) => {
  const incident = await prisma.incident.findFirst({ where: { id: incidentId, organizationId }, select: { id: true } });
  if (!incident) throw new HttpError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  const analysis = await prisma.aIAnalysis.findFirst({ where: { incidentId, organizationId, analysisType: 'POSTMORTEM' }, orderBy: { createdAt: 'desc' } });
  if (!analysis) return null;
  const structured = (analysis.evidence && typeof analysis.evidence === 'object' ? analysis.evidence : {}) as Record<string, unknown>;
  return { ...structured, analysisId: analysis.id, createdAt: analysis.createdAt, model: analysis.model, promptVersion: analysis.promptVersion };
};
