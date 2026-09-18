import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { theme } from '../../theme';
import {
  buildOverviewModel,
  compareOverviewSnapshots,
  type PublishedOverviewRead,
} from './overviewModel';
import { CreditOverviewView } from './CreditOverview';
import { adaptPublishedProfile } from './data';
import type { ClientPlanItem, ClientPlanResponse } from '../../pages/PlanPages';
import type { CreditWorkspaceRead } from '../../queries/creditWorkspace';

const current = {
  id: 'p2',
  reviewId: 'r2',
  publishedAt: '2026-09-16',
  report: { reportDate: '2026-09-15' },
  projection: {
    profile: { experianScore: 720, revolvingBalance: 0 },
    analysisSummary: 'Approved assessment',
    findings: Array.from({ length: 5 }, (_, i) => ({
      code: String(i),
      title: `Finding ${i}`,
      summary: 'Published finding',
      severity: 'INFORMATIONAL',
    })),
  },
};
const read = (): PublishedOverviewRead => ({ current, history: [current] });
const plan = (): ClientPlanResponse => ({
  plan: {
    id: 'plan',
    title: 'Published Plan',
    status: 'ACTIVE',
    version: {
      staleAt: null,
      items: Array.from(
        { length: 5 },
        (_, i) =>
          ({
            id: `item-${i}`,
            title: `Priority ${i}`,
            type: 'GUIDANCE',
            status: 'AVAILABLE',
            owner: 'CLIENT',
            prerequisites: [],
            body: null,
            deepLink: null,
            completionMode: 'ACKNOWLEDGEMENT',
          }) as ClientPlanItem,
      ),
    },
  },
});
const show = (m: ReturnType<typeof buildOverviewModel>) =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <CreditOverviewView model={m} />
      </MemoryRouter>
    </ThemeProvider>,
  );

test('no Review exposes no snapshot, assessment, drafts, sample metrics or fabricated priorities', () => {
  const input = {
    current: null,
    history: [],
    draft: { analysisSummary: 'SECRET DRAFT', profile: { experianScore: 777 } },
  };
  const m = buildOverviewModel(input);
  show(m);
  expect(m.lifecycle).toBe('NO_REVIEW');
  expect(screen.getByRole('link', { name: 'Check your Review options' })).toHaveAttribute(
    'href',
    '/app/credit-center/review',
  );
  expect(screen.queryByText('SECRET DRAFT')).not.toBeInTheDocument();
  expect(screen.queryByText('777')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'What Changed' })).not.toBeInTheDocument();
});
test('unpublished in-progress state routes to its owning Review without draft facts', () => {
  const m = buildOverviewModel({
    current: null,
    history: [],
    workspace: { profile: { status: 'REVIEW_IN_PROGRESS' } } as CreditWorkspaceRead,
  });
  show(m);
  expect(m.lifecycle).toBe('REVIEW_IN_PROGRESS_UNPUBLISHED');
  expect(screen.getByRole('link', { name: 'Follow your Review' })).toBeVisible();
  expect(screen.queryByText('Credit Snapshot', { selector: 'h2' })).not.toBeInTheDocument();
});
test('first publication is a baseline; missing facts stay unknown and a real zero survives', () => {
  const m = buildOverviewModel(read());
  show(m);
  expect(m.changes.state).toBe('BASELINE');
  expect(m.snapshot?.metrics.revolvingBalance?.value).toBe(0);
  expect(m.snapshot?.metrics.revolvingLimit?.value).toBeNull();
  expect(screen.getByText('Your Baseline')).toBeVisible();
  expect(screen.queryByText('+0')).not.toBeInTheDocument();
});
test('legacy prior data cannot create model-less score deltas or unknown-basis metric comparisons', () => {
  const input = read();
  input.history.push({
    ...current,
    id: 'p1',
    publishedAt: '2026-08-01',
    projection: { profile: { experianScore: 600, revolvingBalance: 500 } },
  });
  const m = buildOverviewModel(input);
  expect(m.changes.state).toBe('NOT_COMPARABLE');
  expect(m.changes.items).toHaveLength(0);
});
test('only equivalent known score and metric facts produce nonzero comparisons', () => {
  const previous = adaptPublishedProfile({ experianScore: 700 }, '2026-08-01');
  const next = adaptPublishedProfile({ experianScore: 720 }, '2026-09-01');
  previous.scores[0]!.model = next.scores[0]!.model = 'Published model';
  previous.scores[0]!.range = next.scores[0]!.range = [300, 850];
  expect(compareOverviewSnapshots(next, previous)[0]?.delta).toBe(20);
  next.scores[0]!.model = 'Different model';
  expect(compareOverviewSnapshots(next, previous)).toHaveLength(0);
});
test('findings and Plan priorities keep published order, cap at three and link to owning areas', () => {
  const m = buildOverviewModel(read(), plan());
  show(m);
  expect(m.findings.items.map((f) => f.code)).toEqual(['0', '1', '2']);
  expect(m.priorities.items.map((f) => f.id)).toEqual(['item-0', 'item-1', 'item-2']);
  expect(screen.queryByText('Priority 3')).not.toBeInTheDocument();
  expect(screen.queryByText('Finding 3')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View all Analysis' })).toHaveAttribute(
    'href',
    '/app/credit-center/analysis',
  );
  expect(screen.getByRole('link', { name: 'Priority 0' })).toHaveAttribute(
    'href',
    '/app/credit-center/plan?item=item-0',
  );
});
test('completed priorities are excluded; no-action requires authoritative Plan summary', () => {
  const p = plan();
  p.plan!.version.items.forEach((i) => (i.status = 'COMPLETED'));
  expect(buildOverviewModel(read(), p).priorities.noAction).toBe(false);
  p.summary = { openActionCount: 0 } as NonNullable<ClientPlanResponse['summary']>;
  const m = buildOverviewModel(read(), p);
  show(m);
  expect(m.priorities.items).toHaveLength(0);
  expect(screen.getByText(/No immediate action is required/)).toBeVisible();
});
test('stale publication retains published content and does not display positive reassurance', () => {
  const input = read();
  input.workspace = {
    profile: { status: 'STALE', isCurrent: false, reason: 'EXPIRED' },
  } as CreditWorkspaceRead;
  const m = buildOverviewModel(input);
  show(m);
  expect(screen.getByText('Approved assessment')).toBeVisible();
  expect(screen.getByText('Your published assessment has expired')).toBeVisible();
  expect(m.lifecycle).toBe('STALE_PUBLISHED_PROFILE');
});
test('Plan read failure preserves credit data without claiming no action', () => {
  show(buildOverviewModel(read(), undefined, 'error'));
  expect(screen.getByText('Approved assessment')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Retry Plan' })).toBeVisible();
  expect(screen.queryByText(/No immediate action is required/)).not.toBeInTheDocument();
});

test('an unexpected unpublished Plan is not presented as current priorities', () => {
  const p = plan();
  p.plan!.status = 'DRAFT';
  const m = buildOverviewModel(read(), p);
  show(m);
  expect(m.priorities.available).toBe(false);
  expect(screen.queryByText('Priority 0')).not.toBeInTheDocument();
});
test('comparison view renders only supplied deltas and respects the semantic section order', () => {
  const m = buildOverviewModel(read());
  m.changes = {
    state: 'AVAILABLE',
    items: [
      {
        key: 'score',
        label: 'Comparable score',
        previous: 700,
        current: 720,
        delta: 20,
        suffix: '',
      },
    ],
    total: 1,
  };
  show(m);
  expect(screen.getByText('+20')).toBeVisible();
  const section = screen.getByRole('heading', { name: 'What Changed' }).closest('section')!;
  expect(within(section).getByRole('link', { name: 'View History' })).toHaveAttribute(
    'href',
    '/app/credit-center/history',
  );
  expect(screen.getAllByRole('heading', { level: 2 }).map((e) => e.textContent)).toEqual([
    'Credit Snapshot',
    'What Changed',
    'What Matters Now',
    'Consultant Assessment',
    'Current Priorities',
    'Progress / Next Opportunity',
    'Explore your Credit Center',
  ]);
});

test('finding symbols follow published severity rather than interpreting client copy', () => {
  const input = read();
  input.current = {
    ...current,
    projection: {
      ...current.projection,
      findings: [
        {
          code: 'a',
          title: 'Neutral wording',
          summary: 'Published explanation',
          severity: 'CAUTION',
        },
        {
          code: 'b',
          title: 'Caution appears in this title',
          summary: 'Published explanation',
          severity: 'POSITIVE',
        },
        {
          code: 'c',
          title: 'Another finding',
          summary: 'Published explanation',
          severity: 'CRITICAL',
        },
      ],
    },
  };
  show(buildOverviewModel(input));
  expect(screen.getByRole('img', { name: 'Caution finding' })).toBeVisible();
  expect(screen.getByRole('img', { name: 'Positive finding' })).toBeVisible();
  expect(screen.getByRole('img', { name: 'Critical finding' })).toBeVisible();
});
