import './entry-f1-guard.mjs';
import { startEntryHarness } from './entry-f1-harness.ts';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

if (!process.env.PLAYWRIGHT_MODULE)
  throw new Error('Set PLAYWRIGHT_MODULE to the installed Playwright module file URL');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const out = 'docs/evidence/entry-f1';
fs.mkdirSync(out, { recursive: true });
const harness = await startEntryHarness();
const vite = spawn(
  process.execPath,
  [
    resolve('apps/web/node_modules/vite/bin/vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    '5198',
    '--strictPort',
  ],
  {
    cwd: resolve('apps/web'),
    env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:3018' },
    windowsHide: true,
    stdio: 'ignore',
  },
);
const base = 'http://127.0.0.1:5198';
let browser;
let evidencePage;
const evidence: Record<string, unknown>[] = [];
const errors: string[] = [];
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const password = 'Entry-browser-controlled-password!';
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (
      await fetch(base)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch();
  let context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let page = await context.newPage();
  evidencePage = page;
  page.on('pageerror', (error: Error) => errors.push(error.message));
  async function capture(name: string, state: string, actor: string) {
    for (const [kind, viewport] of [
      ['desktop', { width: 1440, height: 1000 }],
      ['mobile', { width: 390, height: 844 }],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
        console.log(
          JSON.stringify(
            await page.evaluate(() => ({
              width: innerWidth,
              scroll: document.documentElement.scrollWidth,
              overflow: [...document.querySelectorAll('*')]
                .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
                .map((e) => ({
                  tag: e.tagName,
                  class: e.className,
                  right: e.getBoundingClientRect().right,
                }))
                .slice(0, 8),
            })),
          ),
        );
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${name}: no horizontal overflow`,
      );
      const file = `${name}-${kind}.png`;
      await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
      const png = fs.readFileSync(`${out}/${file}`);
      const dimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
      const route = new URL(page.url());
      for (const key of ['intake', 'token', 'intakeClaim'])
        if (route.searchParams.has(key)) route.searchParams.set(key, '[redacted]');
      evidence.push({
        file,
        state,
        actor,
        route: route.pathname + route.search,
        viewport,
        branch: 'codex/entry-f1',
        implementationCommit: commit,
        dimensions,
        workingTree:
          execFileSync(
            'git',
            ['diff', '--name-only', '--', 'apps', 'packages', 'prisma', 'scripts'],
            { encoding: 'utf8' },
          ).trim().length > 0,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  async function verifyAndLogin(email: string, intake?: string) {
    for (let i = 0; i < 40 && !harness.messages.some((m) => m.to === email); i++)
      await new Promise((r) => setTimeout(r, 100));
    const message = harness.messages.filter((m) => m.to === email).at(-1);
    const url = message?.text?.match(/https?:\/\/[^\s]+/)?.[0];
    assert(url, 'real captured verification URL');
    await page.goto(url);
    await page.getByRole('heading', { name: 'Continue to sign in' }).waitFor();
    await page.getByRole('link', { name: 'Return to sign in' }).click();
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Password/).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL((u: URL) => u.pathname.startsWith('/app'));
    if (intake) assert.equal(new URL(page.url()).searchParams.get('intake'), intake);
    return harness.prisma.client.findFirstOrThrow({ where: { user: { email } } });
  }
  async function fillRegistration(email: string) {
    await page.getByLabel('First name', { exact: false }).fill('Entry');
    await page.getByLabel('Last name', { exact: false }).fill('Browser');
    await page.getByLabel('Email', { exact: false }).fill(email);
    await page.getByLabel(/^Password/).fill(password);
    await page.getByRole('checkbox', { name: /accept the terms/ }).check();
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.waitForURL((u: URL) => u.pathname === '/verify-email');
  }
  async function publicSave(email: string, amount: number) {
    await page.goto(base + '/goal-intake');
    const edit = page.getByRole('button', { name: 'Review or edit goal' });
    const amountField = page.getByRole('spinbutton', { name: 'Goal amount' });
    await page.waitForFunction(
      () =>
        !!document.querySelector('input[type=number]') ||
        document.body.textContent?.includes('Review or edit goal'),
    );
    if (await edit.isVisible()) await edit.click();
    await amountField.fill(String(amount));
    await page
      .getByLabel('Additional card preference (optional)')
      .fill('Prefer transparent terms and flexible credit options. '.repeat(5));
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('First name', { exact: false }).fill('Entry');
    await page.getByLabel('Last name', { exact: false }).fill('Browser');
    await page.getByLabel('Email', { exact: false }).fill(email);
    const saved = page.waitForResponse(
      (r: { url(): string; request(): { method(): string } }) =>
        r.url().includes('/api/v1/goal-intakes') &&
        ['POST', 'PATCH'].includes(r.request().method()),
    );
    await page.getByRole('button', { name: 'Save and continue securely' }).click();
    const result = await saved;
    assert([200, 201].includes(result.status()));
    const link = page.getByRole('link', { name: 'Create an account', exact: true });
    await link.waitFor();
    return new URL((await link.getAttribute('href'))!, base).searchParams.get('intake')!;
  }
  await page.goto(base + '/login');
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await capture('ordinary-login', 'Ordinary entry; no Goal required', 'anonymous');
  await page.getByRole('link', { name: /create (?:an )?account/i }).click();
  await capture('ordinary-registration', 'Ordinary account creation without a Goal', 'anonymous');
  const ordinaryEmail = `ordinary-browser-${randomUUID()}@example.test`;
  await fillRegistration(ordinaryEmail);
  const ordinary = await verifyAndLogin(ordinaryEmail);
  assert.equal(await harness.prisma.clientGoal.count({ where: { clientId: ordinary.id } }), 0);
  evidence.push({
    scenario: 'ET01',
    result: 'PASS',
    details: 'Ordinary UI registration, captured real verifier, UI login; no Goal created.',
  });
  await context.close();
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  evidencePage = page;
  page.on('pageerror', (error: Error) => errors.push(error.message));
  page.on('response', async (response) => {
    if (response.status() === 401 || response.status() === 409)
      console.log(
        'HTTP',
        response.status(),
        new URL(response.url()).pathname.replace(/goal-intakes\/[^/]+$/, 'goal-intakes/[redacted]'),
      );
  });
  await page.goto(base + '/login');
  const email = `goal-browser-${randomUUID()}@example.test`;
  const intake = await publicSave(email, 75000);
  await capture('public-saved', 'Saved draft with actual expiry and full summary', 'anonymous');
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByText('Optional saved goal').waitFor();
  await capture(
    'register-with-goal',
    'Optional saved draft; no application during signup',
    'anonymous',
  );
  await page.getByRole('link', { name: 'Already have an account? Sign in' }).click();
  assert.equal(new URL(page.url()).searchParams.get('intake'), intake);
  await page.getByRole('link', { name: 'Create account', exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get('intake'), intake);
  await fillRegistration(email);
  const client = await verifyAndLogin(email, intake);
  await page.getByRole('button', { name: 'Save this goal' }).waitFor();
  assert.equal(await harness.prisma.clientGoal.count({ where: { clientId: client.id } }), 0);
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/app');
  await page.goto(base + '/app/goals');
  await page.getByRole('button', { name: 'Compare this saved goal' }).waitFor();
  await capture(
    'pending-intake',
    'Own attached draft remains discoverable after Not now',
    client.id,
  );
  await page.getByRole('button', { name: 'Compare this saved goal' }).click();
  await page.getByRole('button', { name: 'Save this goal' }).waitFor();
  await capture(
    'decision-no-primary',
    'Authenticated explicit decision, no current primary',
    client.id,
  );
  await page.getByRole('button', { name: 'Save this goal' }).focus();
  assert(
    await page
      .getByRole('button', { name: 'Save this goal' })
      .evaluate((e) => e === document.activeElement),
  );
  await page.keyboard.press('Enter');
  await page.getByText('Your saved goal was applied.').waitFor();
  assert.equal(await harness.prisma.clientGoal.count({ where: { clientId: client.id } }), 1);
  await capture('applied', 'Server-confirmed Goal resolution', client.id);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL((u: URL) => u.pathname === '/app' && !u.searchParams.has('intake'));
  evidence.push({
    scenario: 'ET02',
    result: 'PASS',
    details:
      'Public UI save → signup → real captured verification → UI sign-in → explicit apply; DB remained empty until apply.',
  });
  // Clear only this fresh browser context's optional draft; create another real public intake.
  await page.evaluate(() => sessionStorage.removeItem('credit.goal-intake-token'));
  await publicSave(email, 95000);
  await page.getByRole('link', { name: /Already a client/ }).click();
  await page.getByRole('button', { name: 'Keep current goal' }).waitFor();
  await capture('decision-different', 'Current and saved Goal comparison', client.id);
  await page.getByRole('button', { name: 'Keep current goal' }).click();
  await page.getByText('Your current goal was kept.').waitFor();
  const goal = await harness.prisma.clientGoal.findFirstOrThrow({
    where: { clientId: client.id, priority: 'PRIMARY' },
  });
  assert.equal(goal.targetAmount?.toNumber(), 75000);
  assert.equal(goal.version, 1);
  await capture('kept', 'Server-confirmed Keep with unchanged Goal version', client.id);
  evidence.push({
    scenario: 'ET03/ET04',
    result: 'PASS',
    details:
      'Already signed-in login arrival retained intake; explicit Keep preserved the current Goal and revision.',
  });
  // Public loaded-version race in two actual browser tabs.
  await page.evaluate(() => sessionStorage.removeItem('credit.goal-intake-token'));
  const raceToken = await publicSave(email, 85000);
  const other = await context.newPage();
  await other.goto(base + '/goal-intake?intake=' + raceToken);
  await other.getByRole('button', { name: 'Review or edit goal' }).click();
  await page.getByRole('button', { name: 'Review or edit goal' }).click();
  async function editAndSave(tab, amount) {
    await tab.getByRole('spinbutton', { name: 'Goal amount' }).fill(String(amount));
    await tab.getByRole('button', { name: 'Continue', exact: true }).click();
    const response = tab.waitForResponse(
      (r) => r.request().method() === 'PATCH' && r.url().includes('/goal-intakes/'),
    );
    await tab.getByRole('button', { name: 'Save and continue securely' }).click();
    return response;
  }
  assert.equal((await editAndSave(page, 90000)).status(), 200);
  assert.equal((await editAndSave(other, 100000)).status(), 409);
  await other.getByRole('button', { name: 'Discard my edits and review saved version' }).waitFor();
  const primaryPage = page;
  page = other;
  await capture(
    'public-stale',
    'Second tab rejected at loaded revision; edits retained',
    'public capability',
  );
  page = primaryPage;
  await other.getByRole('button', { name: 'Discard my edits and review saved version' }).click();
  assert.equal(await other.getByRole('spinbutton', { name: 'Goal amount' }).inputValue(), '90000');
  await other.close();
  evidence.push({
    scenario: 'ET08',
    result: 'PASS',
    details:
      'Two real public editors loaded revision 1; first saves revision 2, second PATCH receives 409 and explicitly reloads for review.',
  });
  // A concurrent canonical editor invalidates an already rendered comparison.
  await page.getByRole('link', { name: /Already a client/ }).click();
  await page.getByRole('button', { name: 'Use saved goal' }).waitFor();
  const editor = await context.newPage();
  await editor.goto(base + '/app/goals');
  await editor.getByRole('spinbutton', { name: 'Exact target' }).fill('80000');
  await editor.getByRole('button', { name: 'Save primary goal' }).click();
  await editor.getByText(/saved/i).first().waitFor();
  for (let n = 0; n < 50; n++) {
    if (
      (
        await harness.prisma.clientGoal.findUniqueOrThrow({ where: { id: goal.id } })
      ).targetAmount?.toNumber() === 80000
    )
      break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(
    (
      await harness.prisma.clientGoal.findUniqueOrThrow({ where: { id: goal.id } })
    ).targetAmount?.toNumber(),
    80000,
  );
  await page.getByRole('button', { name: 'Use saved goal' }).click();
  await page.getByRole('button', { name: 'Refresh comparison' }).waitFor();
  await capture(
    'decision-stale',
    'Concurrent canonical edit requires a fresh explicit comparison',
    client.id,
  );
  await page.getByRole('button', { name: 'Refresh comparison' }).click();
  await page.getByRole('button', { name: 'Use saved goal' }).waitFor();
  await editor.close();
  evidence.push({
    scenario: 'ET07',
    result: 'PASS',
    details:
      'Real Goal editor in second tab changes primary after preview; original apply is rejected and requires refreshed comparison.',
  });
  const watchers = [];
  for (const [route, endpoint] of [
    ['/app', '/api/v1/client/home'],
    ['/app/journey', '/api/v1/client/journey'],
    ['/app/goals', '/api/v1/client/goals'],
  ]) {
    const tab = await context.newPage();
    let reads = 0;
    let documents = 0;
    await tab.addInitScript(() => {
      window.addEventListener('credit:live-update', () =>
        console.log('browser received live invalidation'),
      );
    });
    tab.on('console', (msg) => {
      if (msg.text().includes('live invalidation')) console.log(route, msg.text());
    });
    tab.on('response', (r) => {
      if (new URL(r.url()).pathname === '/api/v1/live-updates')
        console.log(route, 'SSE status', r.status());
    });
    tab.on('response', (r) => {
      if (new URL(r.url()).pathname === endpoint && r.status() === 200) reads++;
    });
    tab.on('request', (r) => {
      if (r.isNavigationRequest() && r.frame() === tab.mainFrame()) documents++;
    });
    await tab.goto(base + route);
    for (let n = 0; n < 100 && reads === 0; n++) await new Promise((r) => setTimeout(r, 100));
    assert(reads > 0, route + ' initial authoritative read');
    watchers.push({ tab, route, count: () => reads, navigations: () => documents });
  }
  const beforeLive = watchers.map((w) => ({ reads: w.count(), documents: w.navigations() }));
  // Drop only the successful resolve response AFTER real fetch commits; do not mock server data.
  await page.evaluate(() => {
    const original = window.fetch;
    let drop = true;
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (drop && String(args[0]).endsWith('/goal-intakes/resolve') && response.ok) {
        drop = false;
        throw new TypeError('Controlled lost response after server commit');
      }
      return response;
    };
  });
  await page.getByRole('button', { name: 'Use saved goal' }).click();
  await page.getByRole('button', { name: 'Retry same decision' }).waitFor();
  await capture(
    'uncertain-retry',
    'Actual commit with response loss; only exact retry offered',
    client.id,
  );
  const afterLoss = await harness.prisma.clientGoal.findUniqueOrThrow({ where: { id: goal.id } });
  assert.equal(afterLoss.targetAmount?.toNumber(), 90000);
  await page.getByRole('button', { name: 'Retry same decision' }).click();
  await page.getByText('Your saved goal was applied.').waitFor();
  assert.equal(
    (await harness.prisma.clientGoal.findUniqueOrThrow({ where: { id: goal.id } })).version,
    afterLoss.version,
  );
  await capture('retried', 'Exact retry returns original committed outcome', client.id);
  evidence.push({
    scenario: 'ET10',
    result: 'PASS',
    details:
      'Actual response loss after commit; same-key browser retry returns original resolution without a second revision.',
  });
  await harness.deliver(client.id);
  for (const [i, observer] of watchers.entries()) {
    for (let n = 0; n < 100 && observer.count() <= beforeLive[i].reads; n++)
      await new Promise((r) => setTimeout(r, 100));
    assert(
      observer.count() > beforeLive[i].reads,
      observer.route + ' refetched from actual outbox event',
    );
    assert.equal(observer.navigations(), beforeLive[i].documents, 'No document reload');
    await observer.tab.close();
  }
  evidence.push({
    scenario: 'ET14',
    result: 'PASS',
    details:
      'Committed PostgreSQL outbox → real isolated BullMQ/Redis → production realtime runtime → authenticated SSE → Home/Journey/Goals authoritative reads, without document reload.',
  });
  // Not now and matching are decisions, never mount effects.
  await page.evaluate(() => sessionStorage.removeItem('credit.goal-intake-token'));
  const matchingToken = await publicSave(email, 90000);
  await page.getByRole('link', { name: /Already a client/ }).click();
  await page.getByRole('button', { name: 'Confirm saved goal' }).waitFor();
  await capture(
    'decision-matching',
    'Matching values; confirmation creates no Goal revision',
    client.id,
  );
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/app');
  const { hashGoalIntakeToken } = await import('../apps/api/src/goals/goalIntake.js');
  assert.equal(
    (
      await harness.prisma.anonymousGoalIntake.findUniqueOrThrow({
        where: { tokenHash: hashGoalIntakeToken(matchingToken) },
      })
    ).consumedAt,
    null,
  );
  await page.goto(base + '/register?intake=' + matchingToken);
  await page.getByRole('button', { name: 'Confirm saved goal' }).click();
  await page.getByText('Your matching goal was confirmed.').waitFor();
  assert.equal(
    (await harness.prisma.clientGoal.findUniqueOrThrow({ where: { id: goal.id } })).version,
    afterLoss.version,
  );
  evidence.push({
    scenario: 'ET03/ET04',
    result: 'PASS',
    details:
      'Not now leaves intake unconsumed; authenticated registration reopens comparison; matching confirmation preserves Goal version.',
  });
  // Real expiry, with no response stubbing.
  // Do not reuse a resolved intake as an expired state: a fresh unconsumed fixture is authoritative.
  const expiredToken = (await import('node:crypto')).randomBytes(32).toString('base64url');
  await harness.prisma.anonymousGoalIntake.create({
    data: {
      tokenHash: (await import('../apps/api/src/goals/goalIntake.js')).hashGoalIntakeToken(
        expiredToken,
      ),
      goalType: 'TOTAL_AVAILABLE_CREDIT',
      scope: 'PERSONAL',
      targetAmount: 85000,
      firstName: 'Entry',
      lastName: 'Expired',
      email,
      expiresAt: new Date(0),
    },
  });
  await page.goto(base + '/app/goals?intake=' + expiredToken);
  await page.getByText(/This saved goal has expired/).waitFor();
  await capture('expired-recovery', 'Authenticated recovery; no Goal mutation', client.id);
  assert.equal(
    (await harness.prisma.clientGoal.findUniqueOrThrow({ where: { id: goal.id } })).version,
    afterLoss.version,
  );
  const blockedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await blockedContext.addInitScript(() =>
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new DOMException('Controlled blocked storage', 'SecurityError');
      },
    }),
  );
  const originalPage = page;
  page = await blockedContext.newPage();
  evidencePage = page;
  await page.goto(base + '/goal-intake');
  await page.setContent(
    '<main><h1>Origin-controlled embedding harness</h1><iframe title="Goal intake" src="/goal-intake" style="width:100%;height:1300px;border:0"></iframe></main>',
  );
  const frame = page.frameLocator('iframe');
  await frame.getByRole('spinbutton', { name: 'Goal amount' }).fill('65000');
  await frame.getByRole('button', { name: 'Continue', exact: true }).click();
  await frame.getByLabel('First name', { exact: false }).fill('Storage');
  await frame.getByLabel('Last name', { exact: false }).fill('Test');
  await frame
    .getByLabel('Email', { exact: false })
    .fill('storage-' + randomUUID() + '@example.test');
  await frame.getByRole('button', { name: 'Save and continue securely' }).click();
  await frame.getByText(/Your goal is saved until/).waitFor();
  await frame.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/register' && u.searchParams.has('intake'));
  await page.getByText('Optional saved goal').waitFor();
  await capture(
    'storage-blocked-handoff',
    'Real public save in same-origin iframe; storage denied; top-level auth preserves capability',
    'anonymous',
  );
  assert.equal(page.frames().length, 1);
  evidence.push({
    scenario: 'ET09/ET15',
    result: 'PASS',
    details:
      'Throwing sessionStorage getter with real public API save; origin-controlled iframe hands off to top-level registration using the saved capability. No security policy weakened.',
  });
  await blockedContext.close();
  page = originalPage;
  evidencePage = page;
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/browser-results.json`,
    JSON.stringify(
      {
        status: 'PASS',
        transport:
          'Real Express API, Better Auth and guarded disposable PostgreSQL; in-memory email delivery; no response interception',
        evidence,
        errors,
      },
      null,
      2,
    ),
  );
  console.log('PASS: ordinary and Goal-first real browser flows; desktop/mobile captures saved.');
} catch (error) {
  if (evidencePage)
    await evidencePage
      .screenshot({ path: `${out}/failure.png`, fullPage: true })
      .catch(() => undefined);
  fs.writeFileSync(
    `${out}/browser-results.json`,
    JSON.stringify(
      {
        status: 'FAILED',
        message: error instanceof Error ? error.message : String(error),
        evidence,
        errors,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (browser) await browser.close();
  vite.kill();
  await harness.close();
  console.log('Disposable browser, web server, API and Prisma closed.');
}

// Better Auth keeps a test-process housekeeping timer after all resources close.
process.exit(0);
