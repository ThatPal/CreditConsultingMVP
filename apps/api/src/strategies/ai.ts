import type { DurableAIRuntime } from '../ai/durableRuntime.js';
import type { ProviderRequest, ProviderResponse } from '../ai/runtime.js';

export const STRATEGY_PREPARE_PROCESS = 'round_strategy.prepare';

export type StrategyProposal = {
  authority: 'PROPOSAL_ONLY';
  themes: string[];
  opportunities: string[];
  cautions: string[];
  research: string[];
};

export function prepareDeterministicStrategyProposal(request: ProviderRequest): ProviderResponse {
  const input = request.input as { context?: Record<string, unknown> };
  return {
    result: {
      authority: 'PROPOSAL_ONLY',
      themes: ['Protect current profile strength', 'Match products to the frozen client goal'],
      opportunities: ['Compare current governed offers and approved insights'],
      cautions: ['Human consultant selection, sequencing, and approval are required'],
      research: ['Confirm offer and insight freshness immediately before approval'],
      sourceContextPresent: Boolean(input.context),
    } satisfies StrategyProposal & { sourceContextPresent: boolean },
    confidence: 'medium',
    evidence: [],
    exceptions: [],
    provider: 'deterministic-phase7',
    model: 'fixture-v1',
  };
}

export const strategyValidators = {
  [`${STRATEGY_PREPARE_PROCESS}@1`]: (value: unknown) => {
    const candidate = value as Partial<StrategyProposal> | null;
    return (
      candidate?.authority === 'PROPOSAL_ONLY' &&
      Array.isArray(candidate.themes) &&
      Array.isArray(candidate.opportunities) &&
      Array.isArray(candidate.cautions) &&
      Array.isArray(candidate.research)
    );
  },
};

export async function registerStrategyProcess(runtime: DurableAIRuntime) {
  await runtime.registerProcess({
    processKey: STRATEGY_PREPARE_PROCESS,
    processVersion: 1,
    authorityLevel: 'FACTUAL_LEVEL_1',
    enabled: true,
    modelProfile: 'reasoning_standard',
    inputSchemaVersion: 1,
    outputSchemaVersion: 1,
    maxAttempts: 3,
    dataClassification: 'CLIENT_FINANCIAL_STRATEGY',
    instructionVersion: 'phase12-v1',
    domainConsumer: 'round-strategy',
    allowedContext: [
      'round',
      'goal-snapshot',
      'profile',
      'review',
      'plan',
      'portfolio',
      'wishlist',
      'applications',
      'major-check',
      'entitlement',
      'catalog-freshness',
    ],
  });
}
