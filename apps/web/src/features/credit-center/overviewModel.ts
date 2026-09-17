import type { CreditWorkspaceRead } from '../../queries/creditWorkspace';
import type { ClientPlanResponse } from '../../pages/PlanPages';
import {
  adaptPublishedProfile,
  comparableScores,
  compareCreditValues,
  type CreditExperience,
} from './data';

/** Existing published screen contract. Never pass Review drafts or AIOutput into this adapter. */
export type PublishedOverviewRead = {
  current: null | {
    id: string;
    reviewId: string;
    publishedAt: string;
    projection: {
      profile?: Record<string, unknown>;
      analysisSummary?: string;
      findings?: Array<{ code: string; title: string; summary: string; severity: string }>;
      recommendation?: { explanation: string; outcome: string; reasons: string[] };
    };
    report: null | { reportDate: string | null };
  };
  history: Array<{
    id: string;
    publishedAt: string;
    projection: { profile?: Record<string, unknown> };
    report: null | { reportDate: string | null };
  }>;
  workspace?: CreditWorkspaceRead;
};
export type OverviewChange = {
  key: string;
  label: string;
  previous: number;
  current: number;
  delta: number;
  suffix: string;
};
/** Only equivalent known facts can become deltas. Legacy publications lack this metadata. */
export function compareOverviewSnapshots(
  current: CreditExperience,
  previous: CreditExperience,
): OverviewChange[] {
  const changes: OverviewChange[] = [];
  for (const score of current.scores) {
    const before = previous.scores.find((s) => comparableScores(s, score));
    if (before && score.value !== before.value)
      changes.push({
        key: score.bureau,
        label: score.bureau + ' score',
        previous: before.value!,
        current: score.value!,
        delta: score.value! - before.value!,
        suffix: '',
      });
  }
  for (const [key, fact] of Object.entries(current.metrics)) {
    const before = previous.metrics[key];
    const delta = before ? compareCreditValues(before, fact) : null;
    if (delta !== null && delta !== 0)
      changes.push({
        key,
        label: fact.definition,
        previous: before!.value!,
        current: fact.value!,
        delta,
        suffix: key === 'aggregateUtilization' ? ' pp' : '',
      });
  }
  return changes;
}
export function buildOverviewModel(
  read: PublishedOverviewRead,
  planRead?: ClientPlanResponse,
  planStatus: 'ready' | 'loading' | 'error' = 'ready',
) {
  const published = read.current;
  const workspace = read.workspace;
  const snapshot = published
    ? adaptPublishedProfile(
        published.projection.profile ?? {},
        published.report?.reportDate ?? null,
      )
    : null;
  const prior = published
    ? read.history
        .filter(
          (p) =>
            p.id !== published.id && Date.parse(p.publishedAt) < Date.parse(published.publishedAt),
        )
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0]
    : undefined;
  const allChanges =
    snapshot && prior
      ? compareOverviewSnapshots(
          snapshot,
          adaptPublishedProfile(prior.projection.profile ?? {}, prior.report?.reportDate ?? null),
        )
      : [];
  const findings = published?.projection.findings ?? [];
  const plan =
    planRead?.plan && ['ACTIVE', 'APPROVED', 'STALE', 'COMPLETED'].includes(planRead.plan.status)
      ? planRead.plan
      : null;
  const currentItems =
    plan?.version.items.filter(
      (i) => !['COMPLETED', 'VERIFIED', 'CANCELLED', 'SUPERSEDED', 'SKIPPED'].includes(i.status),
    ) ?? [];
  const noAction = Boolean(plan && planRead?.summary?.openActionCount === 0);
  const inProgress = workspace?.profile?.status === 'REVIEW_IN_PROGRESS';
  const stale = Boolean(published && workspace?.profile && !workspace.profile.isCurrent);
  const partial = Boolean(
    snapshot &&
    (snapshot.scores.some((s) => s.value === null || !s.model || !s.range) ||
      Object.values(snapshot.metrics).some((m) => m.quality !== 'KNOWN')),
  );
  const lifecycle = !published
    ? inProgress
      ? 'REVIEW_IN_PROGRESS_UNPUBLISHED'
      : 'NO_REVIEW'
    : stale
      ? 'STALE_PUBLISHED_PROFILE'
      : !prior
        ? 'FIRST_PUBLISHED_REVIEW'
        : allChanges.length
          ? 'COMPARABLE_HISTORY'
          : 'NONCOMPARABLE_HISTORY';
  const banner = !published
    ? {
        tone: 'info' as const,
        title: inProgress
          ? 'Your first Review is in progress'
          : 'Your Credit Center starts with your first Review',
        body: inProgress
          ? 'Your reviewed credit picture will appear here after publication. Follow your Review for the current status and any steps that need your attention.'
          : 'Your first Review brings your credit facts, professional analysis, and next steps into one place.',
      }
    : stale
      ? {
          tone: 'warning' as const,
          title:
            workspace?.profile.reason === 'EXPIRED'
              ? 'Your published assessment has expired'
              : 'Your published credit picture needs a fresh review',
          body: 'Your last published snapshot remains available below. Check your Review for the next step before relying on it as current.',
        }
      : partial
        ? {
            tone: 'info' as const,
            title: 'A published picture, with some limits',
            body: 'Some source details and calculation coverage are not included in this publication. Available facts are shown; missing information is never treated as zero.',
          }
        : null;
  return {
    lifecycle,
    publishedAt: published?.publishedAt ?? null,
    snapshot,
    banner,
    changes: {
      state: !prior ? 'BASELINE' : allChanges.length ? 'AVAILABLE' : 'NOT_COMPARABLE',
      items: allChanges.slice(0, 3),
      total: allChanges.length,
    },
    findings: { items: findings.slice(0, 3), total: findings.length },
    assessment:
      published?.projection.analysisSummary?.trim() ||
      published?.projection.recommendation?.explanation?.trim() ||
      null,
    priorities: {
      items: currentItems.slice(0, 3),
      total: currentItems.length,
      noAction,
      status: planStatus,
      available: Boolean(plan),
      stale: Boolean(plan?.version.staleAt || plan?.status === 'STALE'),
    },
    progress: workspace?.currentFocus ?? null,
    reviewDestination: '/app/credit-center/review',
  };
}
export type OverviewModel = ReturnType<typeof buildOverviewModel>;
