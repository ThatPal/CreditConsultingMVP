import type { AIException, Evidence } from './runtime.js';
import type { SyntheticTradeline } from './creditReportProcessing.js';

type ExtractedLine = SyntheticTradeline & { evidence: Evidence[]; rawValuePreserved: boolean; confidence: 'high' | 'medium' | 'low' };
export type PortfolioCard = { id: string; issuer: string; cardName: string; maskedIdentifier?: string; portfolioType: 'PERSONAL_CREDIT' | 'BUSINESS_CREDIT' | 'SECURED' | 'NON_REPORTING'; reportsToBureaus?: boolean };
const accountTypes: Record<string, string> = {
  revolving: 'REVOLVING', 'credit card': 'REVOLVING', 'revolving account': 'REVOLVING',
  'secured card': 'REVOLVING', installment: 'INSTALLMENT', mortgage: 'MORTGAGE',
};
const canonicalIssuer = (value: string) => value.toLowerCase().replace(/\b(n\.?a\.?|bank|bk)\b/g, '').replace(/[^a-z0-9]/g, '').trim();
const normalizeType = (value: string) => accountTypes[value.toLowerCase()] ?? 'UNKNOWN';
const reviewException = (key: string, summary: string, evidence: Evidence[]): AIException => ({ key, category: 'RECONCILIATION', summary, materiality: 'material', confidence: 'low', evidence, suggestedResolution: 'Verify source representations', humanReviewRequired: true, blockingBehavior: 'review' });

export function normalizeTradelines(lines: ExtractedLine[]) {
  return lines.map((line) => ({
    ...line,
    raw: { issuer: line.issuer, accountType: line.accountType, status: line.status },
    normalized: { issuerKey: canonicalIssuer(line.issuer), accountType: normalizeType(line.accountType), status: line.status.toUpperCase() },
    normalizationSource: normalizeType(line.accountType) === 'UNKNOWN' ? 'UNRESOLVED' as const : 'DETERMINISTIC' as const,
  }));
}

export function reconcileAccounts(lines: ReturnType<typeof normalizeTradelines>) {
  const groups = new Map<string, typeof lines>();
  const exceptions: AIException[] = [];
  for (const line of lines) {
    if (!line.maskedSuffix || line.normalized.accountType === 'UNKNOWN') {
      groups.set(`unresolved:${line.candidateId}`, [line]);
      exceptions.push(reviewException(`AMBIGUOUS_GROUP_${line.candidateId}`, 'Tradeline cannot be grouped safely', line.evidence));
      continue;
    }
    const key = `${line.normalized.issuerKey}:${line.maskedSuffix}:${line.normalized.accountType}:${line.openedOn ?? 'unknown'}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  const logicalAccounts = [...groups.entries()].map(([identity, sources], index) => {
    const differingFields = ['balance', 'limit', 'status'].filter((field) => new Set(sources.map((source) => String(source[field as keyof typeof source] ?? 'MISSING'))).size > 1);
    if (differingFields.length) exceptions.push(reviewException(`BUREAU_CONFLICT_${index + 1}`, `Bureaus differ on ${differingFields.join(', ')}`, sources.flatMap(({ evidence }) => evidence)));
    return { logicalAccountId: `logical-${index + 1}`, identity, sources, bureaus: sources.map(({ bureau }) => bureau), differingFields, issuerKey: sources[0]?.normalized.issuerKey ?? '', accountType: sources[0]?.normalized.accountType ?? 'UNKNOWN', maskedSuffix: sources[0]?.maskedSuffix };
  });
  return { logicalAccounts, exceptions };
}

export function matchClientCards(logicalAccounts: ReturnType<typeof reconcileAccounts>['logicalAccounts'], cards: PortfolioCard[]) {
  const matches = logicalAccounts.map((account) => {
    const candidates = cards.filter((card) => canonicalIssuer(card.issuer) === account.issuerKey && (!card.maskedIdentifier || card.maskedIdentifier.endsWith(account.maskedSuffix ?? 'NO_MATCH')));
    return candidates.length === 1
      ? { logicalAccountId: account.logicalAccountId, state: 'MATCHED' as const, clientCardId: candidates[0]!.id, confidence: 'high' as const }
      : { logicalAccountId: account.logicalAccountId, state: 'UNRESOLVED' as const, clientCardId: null, confidence: 'low' as const };
  });
  const reportMatchedIds = new Set(matches.flatMap((match) => match.clientCardId ? [match.clientCardId] : []));
  const portfolioOnly = cards.filter((card) => !reportMatchedIds.has(card.id)).map((card) => ({ ...card, reportPresence: false as const }));
  return { matches, portfolioOnly };
}

export function buildReconciledDraft(input: { extraction: { facts: { tradelines: ExtractedLine[] }; provenance: { sourceVersion: string } }; cards: PortfolioCard[]; artifactVersion: number }) {
  const normalized = normalizeTradelines(input.extraction.facts.tradelines);
  const reconciled = reconcileAccounts(normalized);
  const cardMatches = matchClientCards(reconciled.logicalAccounts, input.cards);
  return { artifactVersion: input.artifactVersion, sourceVersion: input.extraction.provenance.sourceVersion, current: true, normalized, ...reconciled, cardMatches };
}

export function staleDraft<T extends { sourceVersion: string; current: boolean }>(draft: T, currentSourceVersion: string) {
  return draft.sourceVersion === currentSourceVersion ? draft : { ...draft, current: false, staleReason: 'UPSTREAM_SOURCE_CHANGED' as const };
}
