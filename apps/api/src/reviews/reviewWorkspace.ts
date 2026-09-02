import { createHash } from 'node:crypto';

export type ReviewContextVersions = {
  report: string; artifacts: string[]; goal: string; cards: string; updates: string;
};
export type VerificationException = {
  key: string; blocking: boolean; status: 'OPEN' | 'RESOLVED' | 'ACCEPTED'; summary: string;
};
export type DraftOverride = {
  fieldPath: string; originalValue: unknown; effectiveValue: unknown; reason: string;
  actorId: string; sourceReference: unknown; createdAt: string;
};
export type ReviewDraftState = {
  version: number; contextVersion: string; profile: Record<string, unknown>;
  overrides: DraftOverride[]; exceptions: VerificationException[];
};

export function reviewContextVersion(input: ReviewContextVersions) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
export function assertConsultantScope(input: { role: string; capabilities: string[]; scopedClientIds: string[]; clientId: string }) {
  if (input.role !== 'CONSULTANT' || !input.capabilities.includes('review.publish') || !input.scopedClientIds.includes(input.clientId))
    throw new Error('NOT_FOUND');
}
export function applyDraftOverride(draft: ReviewDraftState, input: Omit<DraftOverride, 'createdAt'> & { expectedVersion: number }) {
  if (input.expectedVersion !== draft.version) throw new Error('DRAFT_VERSION_CONFLICT');
  const next = structuredClone(draft);
  const existing = next.overrides.findIndex(({ fieldPath }) => fieldPath === input.fieldPath);
  const persisted: DraftOverride = {
    fieldPath: input.fieldPath, originalValue: input.originalValue,
    effectiveValue: input.effectiveValue, reason: input.reason, actorId: input.actorId,
    sourceReference: input.sourceReference, createdAt: new Date().toISOString(),
  };
  if (existing >= 0) next.overrides[existing] = persisted;
  else next.overrides.push(persisted);
  next.version += 1;
  return next;
}
export function resolveException(draft: ReviewDraftState, key: string, reason: string, expectedVersion: number) {
  if (expectedVersion !== draft.version) throw new Error('DRAFT_VERSION_CONFLICT');
  if (!reason.trim()) throw new Error('RESOLUTION_REASON_REQUIRED');
  const next = structuredClone(draft);
  const exception = next.exceptions.find((item) => item.key === key);
  if (!exception) throw new Error('EXCEPTION_NOT_FOUND');
  exception.status = 'RESOLVED';
  next.version += 1;
  return next;
}
export function publicationBlockers(draft: ReviewDraftState, currentContextVersion: string) {
  const blockers: string[] = [];
  if (draft.contextVersion !== currentContextVersion) blockers.push('STALE_REVIEW_CONTEXT');
  blockers.push(...draft.exceptions.filter((item) => item.blocking && item.status === 'OPEN').map((item) => `EXCEPTION:${item.key}`));
  return blockers;
}
export function materializeProfile(sourceProfile: Record<string, unknown>, overrides: DraftOverride[]) {
  const effective = structuredClone(sourceProfile);
  for (const override of overrides) effective[override.fieldPath] = override.effectiveValue;
  return effective;
}
