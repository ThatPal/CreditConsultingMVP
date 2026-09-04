import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type { DurableAIRuntime } from '../ai/durableRuntime.js';
import type { ProviderRequest, ProviderResponse } from '../ai/runtime.js';

export const SUPPORT_AI_PROCESSES = {
  classification: 'support.classify',
  summary: 'support.summarize',
  draft: 'support.draft_reply',
} as const;
export type SupportAIKind = keyof typeof SUPPORT_AI_PROCESSES;

export type SupportAIResult = {
  authority: 'ADVISORY_ONLY';
  kind: SupportAIKind;
  category?: string;
  priority?: string;
  rationale?: string;
  summary?: string;
  draft?: string;
  requiresHumanReview: true;
};

export function prepareDeterministicSupportAssistance(request: ProviderRequest): ProviderResponse {
  const input = request.input as { subject?: string; messages?: Array<{ body: string; internal: boolean }> };
  const visible = input.messages?.filter((message) => !message.internal) ?? [];
  const latest = visible.at(-1)?.body ?? input.subject ?? 'Support request';
  const key = request.process.processKey;
  const kind: SupportAIKind = key === SUPPORT_AI_PROCESSES.classification ? 'classification' : key === SUPPORT_AI_PROCESSES.summary ? 'summary' : 'draft';
  const result: SupportAIResult = kind === 'classification'
    ? { authority: 'ADVISORY_ONLY', kind, category: 'OTHER', priority: 'NORMAL', rationale: 'Suggested from the current conversation; staff must confirm.', requiresHumanReview: true }
    : kind === 'summary'
      ? { authority: 'ADVISORY_ONLY', kind, summary: `${input.subject ?? 'Support request'}: ${latest}`.slice(0, 1000), requiresHumanReview: true }
      : { authority: 'ADVISORY_ONLY', kind, draft: `Thanks for the update. I’m reviewing “${latest.slice(0, 240)}” and will confirm the next support step.` , requiresHumanReview: true };
  return { result, confidence: 'medium', evidence: [], exceptions: [], provider: 'deterministic-support', model: 'fixture-v1' };
}

export const supportAIValidators = Object.fromEntries(Object.values(SUPPORT_AI_PROCESSES).map((key) => [`${key}@1`, (value: unknown) => {
  const result = value as Partial<SupportAIResult> | null;
  return result?.authority === 'ADVISORY_ONLY' && result.requiresHumanReview === true && ['classification', 'summary', 'draft'].includes(result.kind ?? '');
}]));

export async function registerSupportAIProcesses(runtime: DurableAIRuntime) {
  for (const [kind, processKey] of Object.entries(SUPPORT_AI_PROCESSES)) await runtime.registerProcess({
    processKey, processVersion: 1, authorityLevel: 'FACTUAL_LEVEL_1', enabled: true,
    modelProfile: kind === 'classification' ? 'fast_classification' : 'reasoning_standard',
    inputSchemaVersion: 1, outputSchemaVersion: 1, maxAttempts: 3,
    dataClassification: 'CLIENT_SUPPORT_CONVERSATION', instructionVersion: 'phase16-v1',
    domainConsumer: 'support', allowedContext: ['support-case', 'support-messages', 'minimum-safe-context'],
  });
}

export async function enqueueSupportAssistance(prisma: PrismaClient, runtime: DurableAIRuntime, input: { supportCaseId: string; clientId: string; kind: SupportAIKind }) {
  const supportCase = await prisma.supportCase.findFirst({ where: { id: input.supportCaseId, clientId: input.clientId }, include: { messages: { orderBy: { createdAt: 'asc' }, select: { body: true, internal: true, createdAt: true } } } });
  if (!supportCase) throw new Error('SUPPORT_CASE_NOT_FOUND');
  const sourceIdentity = createHash('sha256').update(JSON.stringify([supportCase.id, supportCase.updatedAt, supportCase.messages])).digest('hex');
  return runtime.createAndEnqueue({
    processKey: SUPPORT_AI_PROCESSES[input.kind], processVersion: 1, clientId: input.clientId,
    correlationId: randomUUID(), relatedEntityType: 'SupportCase', relatedEntityId: supportCase.id,
    sourceIdentity, sourceVersions: { supportCase: supportCase.updatedAt.toISOString(), messageCount: String(supportCase.messages.length) },
    input: { subject: supportCase.subject, category: supportCase.category, priority: supportCase.priority, contextType: supportCase.contextType, messages: supportCase.messages },
  });
}

export async function materializeSupportAIOutput(prisma: PrismaClient, completed: Awaited<ReturnType<DurableAIRuntime['processJob']>>) {
  if (completed.relatedEntityType !== 'SupportCase' || completed.status !== 'SUCCEEDED') return null;
  const output = completed.outputs[0];
  if (!output) return null;
  const result = output.result as unknown as SupportAIResult;
  if (result.authority !== 'ADVISORY_ONLY') throw new Error('SUPPORT_AI_AUTHORITY_PROHIBITED');
  const provenance = output.provenance as Record<string, unknown>;
  return prisma.$transaction(async (tx) => {
    await tx.supportAIArtifact.updateMany({ where: { supportCaseId: completed.relatedEntityId, kind: result.kind.toUpperCase(), status: 'PROPOSED', editedAt: null, sentMessageId: null }, data: { status: 'SUPERSEDED', supersededAt: new Date() } });
    const artifact = await tx.supportAIArtifact.create({ data: {
      supportCaseId: completed.relatedEntityId, kind: result.kind.toUpperCase(), aiJobId: completed.id, aiJobOutputId: output.id,
      promptVersion: completed.processDefinition.instructionVersion, sourceMessageCount: Number((completed.sourceVersions as Record<string, string>).messageCount ?? 0),
      structuredOutput: output.result as Prisma.InputJsonValue,
      ...(typeof provenance.provider === 'string' ? { provider: provenance.provider } : {}),
      ...(typeof provenance.model === 'string' ? { model: provenance.model } : {}),
    } });
    await tx.auditEvent.create({ data: { clientId: completed.clientId, action: 'SUPPORT_AI_PROPOSAL_CREATED', entityType: 'SupportAIArtifact', entityId: artifact.id, source: 'AI_RUNTIME', metadata: { kind: result.kind, aiJobId: completed.id, authority: result.authority } } });
    return artifact;
  });
}
