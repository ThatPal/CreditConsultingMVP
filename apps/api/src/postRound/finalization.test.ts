import { describe, expect, test } from 'vitest';
import { buildFinalizationBlockers } from './finalization.js';
describe('Round finalization gate', () => {
  const ready = { sessionEnded: true, openApplication: false, requiredFollowUp: false, criticalAttention: false, finalAnalysis: true, analysisCurrent: true, journey: true };
  test('accepts only the complete current lifecycle boundary', () => expect(buildFinalizationBlockers(ready)).toEqual([]));
  test.each([
    ['open application', { openApplication: true }, 'APPLICATION_UNRESOLVED'],
    ['required follow-up', { requiredFollowUp: true }, 'REQUIRED_FOLLOW_UP_UNRESOLVED'],
    ['critical attention', { criticalAttention: true }, 'CRITICAL_ATTENTION_OPEN'],
    ['stale analysis', { analysisCurrent: false }, 'FINAL_ANALYSIS_STALE'],
    ['live session', { sessionEnded: false }, 'LIVE_SESSION_NOT_ENDED'],
  ])('blocks %s', (_name, change, code) => expect(buildFinalizationBlockers({ ...ready, ...change })).toContain(code));
});
