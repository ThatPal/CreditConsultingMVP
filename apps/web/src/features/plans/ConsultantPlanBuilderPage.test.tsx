import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { apiRequest } from '../../auth/api';
import { theme } from '../../theme';
import { ConsultantPlanBuilderPage } from './ConsultantPlanBuilderPage';

vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { userId: 'consultant' } }) }));
vi.mock('../../auth/api', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
const fixture = (revision = 3, title = 'Prepare for your review') => ({
  clientPublication: null,
  plan: {
    id: 'plan',
    title,
    purpose: 'NURTURE',
    status: 'DRAFT',
    versions: [
      {
        title,
        purpose: 'NURTURE',
        status: 'DRAFT',
        version: 1,
        optimisticVersion: revision,
        paths: [],
        items: ['first', 'second'].map((stableKey, sortOrder) => ({
          stableKey,
          sortOrder,
          type: 'GUIDANCE',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: `${stableKey} step`,
          clientBody: 'Client instructions',
          consultantRationale: 'Private analysis',
          required: true,
          status: 'LOCKED',
          pathMemberships: [],
          prerequisites: [],
        })),
      },
    ],
  },
  context: {},
});
function setup(entry = '/crm/clients/client/plan') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/crm/clients/:clientId/plan" element={<ConsultantPlanBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return Object.assign(client, { unmount: view.unmount });
}
beforeEach(() => {
  sessionStorage.clear();
  request.mockReset();
  request.mockResolvedValue(fixture());
});

test('offers identity verification with a return to the saved draft after denied approval', async () => {
  request.mockImplementation(async (path) => {
    if (path.endsWith('/approve')) throw Object.assign(new Error('Access denied'), { status: 403 });
    return fixture();
  });
  setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.click(screen.getByRole('button', { name: 'Review & approve' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve this version' }),
  );
  expect(await screen.findByRole('link', { name: 'Verify identity' })).toHaveAttribute(
    'href',
    '/mfa?mode=challenge&returnTo=%2Fcrm%2Fclients%2Fclient%2Fplan',
  );
});

test('retains unsaved edits when a background refresh brings a conflicting version', async () => {
  const client = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'My local changes' },
  });
  await act(async () => {
    client.setQueryData(['plan-builder', 'client'], fixture(4, 'Another saved title'));
  });
  expect(screen.getByDisplayValue('My local changes')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled());
  expect(screen.getByRole('button', { name: 'Review & approve' })).toBeDisabled();
});

test('failed saves retain edits and permit retry', async () => {
  setup();
  await screen.findByDisplayValue('Prepare for your review');
  request.mockImplementation(async (_path, init) => {
    if (init?.method === 'PUT') throw new Error('Connection interrupted');
    return fixture();
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Keep my work' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText(/Connection interrupted/);
  expect(screen.getByDisplayValue('Keep my work')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
});

test('approval preview excludes private rationale and sends the reviewed revision', async () => {
  setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.click(screen.getByRole('button', { name: 'Review & approve' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).queryByText('Private analysis')).not.toBeInTheDocument();
  expect(within(dialog).getByText('first step')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: /Approve/ }));
  await waitFor(() =>
    expect(request.mock.calls.some(([path]) => path.endsWith('/approve'))).toBe(true),
  );
  const call = request.mock.calls.find(([path]) => path.endsWith('/approve'))!;
  expect(JSON.parse(String(call[1]?.body))).toEqual({
    expectedVersion: 3,
    expectedPublication: null,
  });
  expect(call[1]?.headers).toBeUndefined();
});

test('restores unfinished edits after remount without advancing their original revision', async () => {
  const view = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Recovered work' },
  });
  view.unmount();
  request.mockResolvedValue(fixture(4, 'Newer server work'));
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Restore unfinished edits' }));
  expect(screen.getByDisplayValue('Recovered work')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Review & approve' })).toBeDisabled();
});

test('can discard the tab copy and open the current server Plan', async () => {
  const view = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Discard me' },
  });
  view.unmount();
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Discard tab copy' }));
  expect(screen.getByDisplayValue('Prepare for your review')).toBeInTheDocument();
  expect(sessionStorage.length).toBe(0);
});

test('ignores an expired recovery copy and shows the server version', async () => {
  const view = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Old edits' },
  });
  view.unmount();
  const key = sessionStorage.key(0)!;
  const stored = JSON.parse(sessionStorage.getItem(key)!);
  sessionStorage.setItem(
    key,
    JSON.stringify({ ...stored, savedAt: Date.now() - 25 * 60 * 60 * 1000 }),
  );
  setup();
  await screen.findByDisplayValue('Prepare for your review');
  expect(
    screen.queryByRole('button', { name: 'Restore unfinished edits' }),
  ).not.toBeInTheDocument();
});

test('compares conflicting content without discarding local edits', async () => {
  const client = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'My proposed title' },
  });
  await act(async () => {
    client.setQueryData(['plan-builder', 'client'], fixture(4, 'Shared revised title'));
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Review saved version' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('My proposed title')).toBeVisible();
  expect(within(dialog).getByText('Shared revised title')).toBeVisible();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Keep my edits' }));
  expect(await screen.findByDisplayValue('My proposed title')).toBeInTheDocument();
  expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
});

test('selected wording uses the newer revision only after explicit save', async () => {
  const client = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Chosen wording' },
  });
  await act(async () => {
    client.setQueryData(['plan-builder', 'client'], fixture(4, 'New saved title'));
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Review saved version' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Keep my Plan title' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Use selected wording in a new working copy' }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: 'Plan title' })).toHaveValue('Chosen wording');
  expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  expect(screen.getByRole('button', { name: 'Review & approve' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() =>
    expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true),
  );
  const write = request.mock.calls.find(([, options]) => options?.method === 'PUT')!;
  expect(JSON.parse(String(write[1]?.body))).toMatchObject({
    expectedVersion: 4,
    draft: { title: 'Chosen wording' },
  });
});

test('distinguishes the private working version from a paused client publication', async () => {
  request.mockResolvedValue({
    ...fixture(),
    clientPublication: {
      planId: 'plan',
      title: 'Published preparation',
      version: 1,
      status: 'STALE',
      staleAt: '2026-09-10T00:00:00Z',
    },
  });
  setup();
  await screen.findByDisplayValue('Prepare for your review');
  expect(screen.getByText(/Client publication: Published preparation, version 1/)).toBeVisible();
  expect(screen.getByText(/Client actions are paused for source review/)).toBeVisible();
});

test('loads a selected Plan and stores its recovery copy separately from the default workspace', async () => {
  const view = setup('/crm/clients/client/plan?planId=older');
  await screen.findByDisplayValue('Prepare for your review');
  expect(request).toHaveBeenCalledWith('/api/v1/consultant/clients/client/plan?planId=older');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Older private work' },
  });
  await waitFor(() =>
    expect(sessionStorage.getItem('astra:plan-authoring:v1:consultant:client:older')).toContain(
      'Older private work',
    ),
  );
  expect(sessionStorage.getItem('astra:plan-authoring:v1:consultant:client')).toBeNull();
  view.unmount();
  setup();
  await screen.findByDisplayValue('Prepare for your review');
  expect(screen.queryByDisplayValue('Older private work')).not.toBeInTheDocument();
});

test('closed selected Plans expose history without authoring controls', async () => {
  const closed = fixture();
  closed.plan.status = 'CANCELLED';
  request.mockResolvedValue(closed);
  setup('/crm/clients/client/plan?planId=closed');
  expect(await screen.findByText(/This Plan is closed/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Version history' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
});

test('approval preview explains when a different Plan will become current without publishing on preview', async () => {
  request.mockResolvedValue({
    ...fixture(),
    clientPublication: {
      planId: 'other',
      title: 'Existing client instructions',
      version: 2,
      status: 'ACTIVE',
      staleAt: null,
    },
  });
  setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.click(screen.getByRole('button', { name: 'Review & approve' }));
  expect(
    within(screen.getByRole('dialog')).getByText(
      /replacing Existing client instructions in the current Plan view/,
    ),
  ).toBeVisible();
  expect(request.mock.calls.some(([path]) => path.endsWith('/approve'))).toBe(false);
});

test('starts a blank separate Plan and binds successful creation before retrying a failed read', async () => {
  let reads = 0;
  request.mockImplementation(async (path, options) => {
    if (options?.method === 'POST' && path.endsWith('/plans'))
      return { planId: 'created', optimisticVersion: 1, version: 1 };
    if (path.endsWith('?mode=new')) return { plan: null, context: {} };
    if (path.endsWith('?planId=created')) {
      reads++;
      if (reads === 1) throw new Error('Read temporarily unavailable');
      const saved = fixture(1, 'Separate preparation');
      saved.plan.id = 'created';
      return saved;
    }
    return { plan: null };
  });
  const view = setup('/crm/clients/client/plan?planId=new');
  await screen.findByDisplayValue('Credit preparation plan');
  expect(request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Separate preparation' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Client title' }), {
    target: { value: 'Review your next steps' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() =>
    expect(
      request.mock.calls.filter(
        ([path, options]) => path.endsWith('/plans') && options?.method === 'POST',
      ),
    ).toHaveLength(1),
  );
  await waitFor(() => expect(reads).toBeGreaterThan(0));
  await act(async () => {
    await view.invalidateQueries({ queryKey: ['plan-builder', 'client', 'created'] });
  });
  await screen.findByDisplayValue('Separate preparation');
  expect(
    request.mock.calls.filter(
      ([path, options]) => path.endsWith('/plans') && options?.method === 'POST',
    ),
  ).toHaveLength(1);
});

test('reuses the first-save request after an uncertain response and a tab reload', async () => {
  const keys: string[] = [];
  request.mockImplementation(async (path, options) => {
    if (options?.method === 'POST' && path.endsWith('/plans')) {
      keys.push((options.headers as Record<string, string>)['Idempotency-Key']!);
      if (keys.length === 1) throw new Error('Connection interrupted');
      return { planId: 'recovered', optimisticVersion: 1, version: 1 };
    }
    if (path.endsWith('?mode=new')) return { plan: null, context: {} };
    if (path.endsWith('?planId=recovered')) {
      const saved = fixture(1, 'Recovered plan');
      saved.plan.id = 'recovered';
      return saved;
    }
    return { plan: null };
  });
  const first = setup('/crm/clients/client/plan?planId=new');
  await screen.findByDisplayValue('Credit preparation plan');
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Client title' }), {
    target: { value: 'Read the guidance' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText(/Connection interrupted/);
  expect(screen.getByRole('textbox', { name: 'Plan title' })).toBeDisabled();
  first.unmount();
  setup('/crm/clients/client/plan?planId=new');
  expect(await screen.findByRole('button', { name: 'Discard tab copy' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Restore unfinished edits' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));
  await screen.findByDisplayValue('Recovered plan');
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});

test('unlocks a draft after the server confirms that creation rolled back', async () => {
  request.mockImplementation(async (path, options) => {
    if (options?.method === 'POST')
      throw Object.assign(new Error('Choose a valid source'), {
        code: 'PLAN_CREATE_REJECTED',
        status: 409,
      });
    if (path.endsWith('?mode=new')) return { plan: null, context: {} };
    return { plan: null };
  });
  setup('/crm/clients/client/plan?planId=new');
  await screen.findByDisplayValue('Credit preparation plan');
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Client title' }), {
    target: { value: 'Read the guidance' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText(/Choose a valid source/);
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Plan title' })).not.toBeDisabled(),
  );
  expect(screen.queryByText(/The first save needs confirmation/)).not.toBeInTheDocument();
});

test('approval keeps the preview publication snapshot when background context changes', async () => {
  const publication = {
    planId: 'old-published',
    title: 'Previously published',
    version: 2,
    status: 'ACTIVE',
    staleAt: null,
  };
  request.mockResolvedValue({ ...fixture(), clientPublication: publication });
  const client = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.click(screen.getByRole('button', { name: 'Review & approve' }));
  await act(async () => {
    client.setQueryData(['plan-builder', 'client'], {
      ...fixture(),
      clientPublication: {
        ...publication,
        planId: 'new-published',
        title: 'Newly published',
        version: 1,
      },
    });
  });
  request.mockImplementation(async (path) => {
    if (path.endsWith('/approve'))
      throw Object.assign(new Error('Publication changed'), {
        code: 'PLAN_PUBLICATION_CHANGED',
        status: 409,
      });
    return {
      ...fixture(),
      clientPublication: {
        ...publication,
        planId: 'new-published',
        title: 'Newly published',
        version: 1,
      },
    };
  });
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve this version' }),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh publication context' }));
  const approval = request.mock.calls.find(([path]) => path.endsWith('/approve'));
  expect(JSON.parse(approval![1]!.body as string).expectedPublication).toEqual({
    planId: 'old-published',
    version: 2,
  });
  await screen.findByText(/Publication context refreshed/);
  expect(request.mock.calls.filter(([path]) => path.endsWith('/approve'))).toHaveLength(1);
});

test.each(['accepted', 'unknown'])(
  'approval recovery reloads publication without repeating the write (%s)',
  async (outcome) => {
    let attempted = false;
    let failRead = true;
    request.mockImplementation(async (path) => {
      if (path.includes('/plan/execution')) return { plan: null };
      if (path.endsWith('/approve')) {
        attempted = true;
        if (outcome === 'unknown') throw new Error('Connection lost');
        return {};
      }
      if (path === '/api/v1/consultant/clients/client/plan' && attempted && failRead)
        throw new Error('Read interrupted');
      const data = fixture();
      if (attempted) {
        data.plan.status = 'ACTIVE';
        data.plan.versions[0]!.status = 'ACTIVE';
      }
      return data;
    });
    setup();
    await screen.findByDisplayValue('Prepare for your review');
    fireEvent.click(screen.getByRole('button', { name: 'Review & approve' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve this version' }),
    );
    if (outcome === 'unknown') {
      await screen.findByText('Connection lost');
      expect(screen.getByRole('button', { name: 'Approve this version' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Refresh publication context' }));
      await screen.findByText('Publication could not be loaded. Retry the refresh.');
      fireEvent.click(screen.getByRole('button', { name: 'Back to editing' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    } else {
      await screen.findByText(
        /Approval was accepted, but the latest publication still needs to be checked/,
      );
      expect(screen.getByText(/Approval accepted. This version was published/)).toBeVisible();
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Review & approve' })).toBeDisabled();
    failRead = false;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh publication context' }));
    await screen.findByText(/Publication context refreshed/);
    expect(screen.getByRole('button', { name: 'Review & approve' })).toBeDisabled();
    expect(request.mock.calls.filter(([path]) => path.endsWith('/approve'))).toHaveLength(1);
  },
);

test.each(['accepted', 'unknown'])(
  'source update recovers without repeating the mutation (%s)',
  async (outcome) => {
    let attempted = false;
    let failRead = true;
    request.mockImplementation(async (path) => {
      if (path.includes('/plan/execution')) return { plan: null };
      if (path.endsWith('/sources'))
        return {
          fingerprint: 'a'.repeat(64),
          changed: true,
          expectedVersion: 3,
          hasPublishedPlan: true,
          changes: [
            {
              field: 'profile',
              label: 'Credit profile',
              before: 'Version 1',
              after: 'Version 2',
              changed: true,
            },
          ],
          keptSteps: [{ title: 'Completed preparation', status: 'COMPLETED' }],
        };
      if (path.endsWith('/reconcile')) {
        attempted = true;
        if (outcome === 'unknown') throw new Error('Connection interrupted');
        return {};
      }
      if (path === '/api/v1/consultant/clients/client/plan' && attempted && failRead)
        throw new Error('Read unavailable');
      return fixture(attempted ? 4 : 3);
    });
    setup();
    await screen.findByDisplayValue('Prepare for your review');
    fireEvent.click(screen.getByRole('button', { name: 'Compare sources' }));
    const dialog = await screen.findByRole('dialog', { name: 'Compare sources' });
    expect(await within(dialog).findByText('Completed preparation · completed')).toBeVisible();
    const reason = screen.getByRole('textbox', { name: 'Reason for source review' });
    expect(reason).toHaveAttribute('maxlength', '1000');
    fireEvent.change(reason, { target: { value: 'Use the newly published source.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update draft sources' }));
    if (outcome === 'unknown') {
      await screen.findByText('Connection interrupted');
      expect(screen.getByRole('button', { name: 'Update draft sources' })).toBeDisabled();
      expect(reason).toHaveValue('Use the newly published source.');
      fireEvent.click(screen.getByRole('button', { name: 'Reload Plan after source update' }));
      await screen.findByText('The Plan could not be loaded. Retry the reload.');
      fireEvent.click(screen.getByRole('button', { name: 'Close source comparison' }));
    } else await screen.findByText(/The source update was accepted, but/);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Review & approve' })).toBeDisabled();
    failRead = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reload Plan after source update' }));
    await screen.findByText(/Plan reloaded. Open Compare sources/);
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    expect(request.mock.calls.filter(([path]) => path.endsWith('/reconcile'))).toHaveLength(1);
    const call = request.mock.calls.find(([path]) => path.endsWith('/reconcile'))!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      expectedVersion: 3,
      expectedSourceFingerprint: 'a'.repeat(64),
      reason: 'Use the newly published source.',
    });
  },
);

test.each(['fingerprint', 'revision'])(
  'keeps the reviewed source snapshot until explicitly replaced (%s)',
  async (changed) => {
    const original = {
      fingerprint: 'a'.repeat(64),
      expectedVersion: 3,
      changed: true,
      hasPublishedPlan: true,
      changes: [
        {
          field: 'goal',
          label: 'Primary goal',
          before: 'Original goal',
          after: 'First reviewed goal',
          changed: true,
        },
      ],
      keptSteps: [],
    };
    const latest = {
      ...original,
      fingerprint: changed === 'fingerprint' ? 'b'.repeat(64) : original.fingerprint,
      expectedVersion: changed === 'revision' ? 4 : 3,
      changes: [{ ...original.changes[0]!, after: 'Newly changed goal' }],
    };
    request.mockImplementation(async (path) => (path.endsWith('/sources') ? original : fixture()));
    const cache = setup();
    await screen.findByDisplayValue('Prepare for your review');
    fireEvent.click(screen.getByRole('button', { name: 'Compare sources' }));
    await screen.findByText('Latest: First reviewed goal');
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason for source review' }), {
      target: { value: 'Keep my reasoning while I compare.' },
    });
    await act(async () => {
      cache.setQueryData(['plan-sources', 'client', 'plan'], latest);
    });
    await screen.findByRole('button', { name: 'Load latest comparison' });
    expect(screen.getByText('Latest: First reviewed goal')).toBeVisible();
    expect(screen.queryByText('Latest: Newly changed goal')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update draft sources' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Reason for source review' })).toHaveValue(
      'Keep my reasoning while I compare.',
    );
    expect(request.mock.calls.some(([path]) => path.endsWith('/reconcile'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Load latest comparison' }));
    expect(screen.getByText('Latest: Newly changed goal')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Update draft sources' }));
    await waitFor(() =>
      expect(request.mock.calls.some(([path]) => path.endsWith('/reconcile'))).toBe(true),
    );
    const sent = request.mock.calls.find(([path]) => path.endsWith('/reconcile'))!;
    expect(JSON.parse(String(sent[1]?.body))).toMatchObject({
      expectedSourceFingerprint: latest.fingerprint,
      expectedVersion: latest.expectedVersion,
      reason: 'Keep my reasoning while I compare.',
    });
  },
);
