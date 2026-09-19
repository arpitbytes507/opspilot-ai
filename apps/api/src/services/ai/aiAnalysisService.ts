import { z } from 'zod';

import { config } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../utils/httpError';
import { buildIncidentContext } from './incidentContextService';

const evidenceSchema = z.object({ type: z.enum(['event', 'deployment', 'history', 'metric']), id: z.string().max(200), reason: z.string().min(1).max(1000) });
const recommendationSchema = z.object({ action: z.string().min(1).max(1000), reason: z.string().min(1).max(1000), priority: z.enum(['HIGH', 'MEDIUM', 'LOW']) });
const responseSchema = z.object({ analysisType: z.literal('ROOT_CAUSE'), rootCause: z.string().min(1).max(2000), confidence: z.number().min(0).max(1), summary: z.string().min(1).max(4000), evidence: z.array(evidenceSchema).max(20), recommendations: z.array(recommendationSchema).max(20), alternativeCauses: z.array(z.object({ cause: z.string().min(1).max(1000), confidence: z.number().min(0).max(1) })).max(10), model: z.string().max(200), modelVersion: z.string().max(200).nullable().optional(), promptVersion: z.string().max(50), inputTokens: z.number().int().nonnegative().optional(), outputTokens: z.number().int().nonnegative().optional() });
type AnalysisResponse = z.infer<typeof responseSchema>;

const callAIService = async (context: Record<string, unknown>): Promise<AnalysisResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.aiRequestTimeoutMs);

  try {
    const response = await fetch(`${config.aiServiceUrl}/analyze/incident`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Service-Key': config.aiServiceSecret,
      },
      body: JSON.stringify({
        analysisType: 'ROOT_CAUSE',
        ...context,
      }),
      signal: controller.signal,
    });

    const body = await response.json();

    console.log(
      'AI analysis HTTP response:',
      response.status,
      JSON.stringify(body, null, 2),
    );

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }

    return responseSchema.parse(body);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error(
        'AI analysis response validation failed:',
        JSON.stringify(error.issues, null, 2),
      );

      throw new HttpError(
        502,
        'AI_ANALYSIS_INVALID_RESPONSE',
        'AI analysis returned an invalid response',
      );
    }
    console.error('AI analysis request failed:', error);
    throw error;
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
  const result = await callAIService(context);
  const analysis = await prisma.aIAnalysis.create({ data: { organizationId, incidentId, analysisType: 'ROOT_CAUSE', rootCause: result.rootCause, confidence: result.confidence, evidence: { summary: result.summary, items: result.evidence, alternativeCauses: result.alternativeCauses }, recommendations: result.recommendations, model: result.model, modelVersion: result.modelVersion, promptVersion: result.promptVersion, inputTokens: result.inputTokens, outputTokens: result.outputTokens, processingTimeMs: Date.now() - startedAt } });
  return formatAnalysis(analysis);
};