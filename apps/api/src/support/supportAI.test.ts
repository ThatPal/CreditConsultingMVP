import { describe, expect, test } from 'vitest';
import { prepareDeterministicSupportAssistance, SUPPORT_AI_PROCESSES, supportAIValidators } from './supportAI.js';

const request = (processKey: string) => ({
  jobId: 'job-1',
  process: { processKey, processVersion: 1, authorityLevel: 'FACTUAL_LEVEL_1' as const, enabled: true, modelProfile: 'test', inputSchemaVersion: 1, outputSchemaVersion: 1, maxAttempts: 3, dataClassification: 'SUPPORT' },
  input: { subject: 'Document question', messages: [{ body: 'Where is my file?', internal: false }, { body: 'Internal-only note', internal: true }] },
  sourceVersions: { messageCount: '2' },
});

describe('durable Support AI contract', () => {
  test.each(Object.entries(SUPPORT_AI_PROCESSES))('produces a structured advisory-only %s proposal', (kind, processKey) => {
    const response = prepareDeterministicSupportAssistance(request(processKey));
    expect(response.result).toMatchObject({ authority: 'ADVISORY_ONLY', kind, requiresHumanReview: true });
    expect(supportAIValidators[`${processKey}@1`]?.(response.result)).toBe(true);
    expect(JSON.stringify(response.result)).not.toContain('Internal-only note');
  });

  test('never validates an autonomous or authoritative output', () => {
    expect(supportAIValidators['support.draft_reply@1']?.({ authority: 'AUTONOMOUS', kind: 'draft', requiresHumanReview: false })).toBe(false);
  });
});
