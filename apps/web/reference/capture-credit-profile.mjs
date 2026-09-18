// Run from the Astra workspace with PLAYWRIGHT_MODULE (file URL), REFERENCE_EMAIL and REFERENCE_PASSWORD.
if (
  !process.env.PLAYWRIGHT_MODULE ||
  !process.env.REFERENCE_EMAIL ||
  !process.env.REFERENCE_PASSWORD
)
  throw new Error('Reference capture environment required');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out = 'docs/evidence/ui-credit-profile-rereview';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  reducedMotion: 'reduce',
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5195/login');
  await page.getByLabel(/^Email/).fill(process.env.REFERENCE_EMAIL);
  await page.getByLabel(/^Password/).fill(process.env.REFERENCE_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/app');
  await page.route('**/api/**', (r) =>
    ['GET', 'HEAD', 'OPTIONS'].includes(r.request().method()) ? r.continue() : r.abort(),
  );
  const url = 'http://127.0.0.1:5195/app/credit-center/profile';
  const full = async (name) => {
    const before = page.viewportSize();
    const height = Math.ceil(
      (await page.getByRole('article', { name: 'Credit Profile' }).boundingBox()).height + 700,
    );
    await page.setViewportSize({ width: before.width, height });
    // Wait for the internal viewport to resize and paint, not just the screenshot canvas.
    await page.waitForFunction(() => {
      const link = [...document.querySelectorAll('a')].find(
        (a) => a.textContent.trim() === 'See Analysis',
      );
      if (!link) return false;
      const rect = link.getBoundingClientRect();
      return (
        document
          .elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          ?.closest('a') === link
      );
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: out + '/' + name + '.png' });
    await page.setViewportSize(before);
    await page.waitForTimeout(300);
  };
  await page.goto(url);
  await page.getByRole('article', { name: 'Credit Profile' }).waitFor();
  await page.waitForLoadState('networkidle');
  const check = async () => {
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      'No horizontal overflow',
    );
  };
  await check();
  await page.screenshot({ path: out + '/desktop.png' });
  await full('desktop-full');
  const gallery = page.getByRole('region', { name: 'Bureau scores' });
  await gallery.getByRole('button', { name: 'Experian', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(
    await gallery
      .getByRole('button', { name: 'Equifax', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: /Accounts & credit mix/ }).click();
  assert.equal(
    await page.getByRole('button', { name: /Accounts & credit mix/ }).getAttribute('aria-expanded'),
    'true',
  );
  await full('desktop-disclosure-open');
  await page.goto(url + '#age');
  await page.waitForFunction(() => document.activeElement?.id === 'profile-heading-age');
  assert.equal(
    await page.getByRole('button', { name: /Account age & timing/ }).getAttribute('aria-expanded'),
    'true',
  );
  await page.getByRole('button', { name: /Payment history/ }).click();
  assert.equal(
    await page.getByRole('button', { name: /Account age & timing/ }).getAttribute('aria-expanded'),
    'true',
  );
  await page.goto(url);
  await page.getByRole('article', { name: 'Credit Profile' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await check();
  await page.screenshot({ path: out + '/mobile.png' });
  await full('mobile-full');
  const section = page.getByRole('button', { name: 'Credit Center section: Credit Profile' });
  await section.click();
  const dialog = page.getByRole('dialog', { name: 'Credit Center sections' });
  await dialog.waitFor();
  assert.equal(await dialog.getByRole('link').count(), 6);
  await page.screenshot({ path: out + '/mobile-section.png' });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await section.evaluate((e) => document.activeElement === e), true);
  for (const width of [360, 390, 768, 1199, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await check();
  }
  // Reference evidence injects a typed fixture at the component view-model boundary in this browser only.
  // No fixture import or fallback is added to application code.
  const modulePattern = '**/src/pages/PublishedCreditCenterPages.tsx*';
  await page.route(modulePattern, async (route) => {
    const response = await route.fetch();
    let code = await response.text();
    const needle =
      'const experience = adaptPublishedProfile(profile, current?.report?.reportDate ?? null);';
    assert.ok(code.includes(needle), 'Known Profile view-model boundary');
    code =
      'import { referenceProfile } from "/reference/credit-profile.fixture.ts";\n' +
      code.replace(
        needle,
        'const experience = view === "profile" ? referenceProfile : adaptPublishedProfile(profile, current?.report?.reportDate ?? null);',
      );
    await route.fulfill({ response, body: code, contentType: 'application/javascript' });
  });
  await page.goto(url);
  await page.getByText('Reference scoring model', { exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByRole('img', { name: /percent utilization/ }).count(), 5);
  assert.equal(await page.getByText(/Waiting and restrictions/).count(), 0);
  await check();
  await page.screenshot({ path: out + '/reference-desktop.png' });
  await full('reference-desktop-full');
  await page.getByRole('button', { name: /Accounts & credit mix/ }).click();
  await full('reference-mix-open');
  await page.getByRole('button', { name: /Accounts & credit mix/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await check();
  await page.screenshot({ path: out + '/reference-mobile.png' });
  await full('reference-mobile-full');
  for (const width of [360, 390, 768, 1199, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await check();
  }
  await page.unroute(modulePattern);
  let scenario = 'PARTIAL';
  await page.route('**/api/v1/client/credit-profile', async (r) => {
    const response = await r.fetch();
    const body = await response.json();
    if (scenario === 'PARTIAL')
      body.current = {
        ...body.current,
        projection: {
          profile: {
            experianScore: 720,
            openAccounts: 0,
            revolvingBalance: 2500,
            internalNotes: 'DO_NOT_RENDER_INTERNAL',
            extractionConfidence: 'DO_NOT_RENDER_INTERNAL',
          },
        },
      };
    else if (scenario === 'STALE')
      body.workspace = {
        ...body.workspace,
        profile: { status: 'STALE', isCurrent: false, reason: 'EXPIRED' },
      };
    else {
      body.current = null;
      body.history = [];
      body.draft = { experianScore: 999 };
      body.workspace = {
        ...body.workspace,
        profile: {
          status: scenario === 'NO_REVIEW' ? 'NOT_AVAILABLE' : 'REVIEW_IN_PROGRESS',
          isCurrent: false,
          reason: 'NO_PUBLICATION',
        },
      };
    }
    await r.fulfill({ response, json: body });
  });
  await page.goto(url);
  await page.getByRole('article', { name: 'Credit Profile' }).waitFor();
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByText('DO_NOT_RENDER_INTERNAL').count(), 0);
  await full('desktop-partial-fixture');
  scenario = 'STALE';
  await page.reload();
  await page.getByText('Your published assessment has expired').waitFor();
  await page.getByRole('article', { name: 'Credit Profile' }).waitFor();
  await page.screenshot({ path: out + '/desktop-stale-fixture.png' });
  scenario = 'NO_REVIEW';
  await page.reload();
  await page.getByRole('heading', { name: 'Your Credit Profile starts with a Review' }).waitFor();
  assert.equal(await page.getByRole('article', { name: 'Credit Profile' }).count(), 0);
  await page.screenshot({ path: out + '/desktop-no-review-fixture.png' });
  scenario = 'IN_PROGRESS';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('heading', { name: 'Your Credit Profile is being prepared' }).waitFor();
  assert.equal(await page.getByText('999', { exact: true }).count(), 0);
  await page.screenshot({ path: out + '/mobile-in-progress-fixture.png', fullPage: true });
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + '/browser-results.json',
    JSON.stringify(
      {
        passed: true,
        liveData: 'Synthetic local client, authoritative published read',
        fixtures: ['TYPED_FULL_DATA_REFERENCE', 'PARTIAL', 'STALE', 'NO_REVIEW', 'IN_PROGRESS'],
        checks: [
          'Typed full-data reference: five ranked rows, supplied model/range, capacity, mix, inquiries, negatives, differences and source factors',
          'Workflow restrictions absent',
          'Focal bureau arrow keyboard',
          'Independent disclosures',
          'Anchor expands and focuses',
          'Six inherited mobile destinations and focus restoration',
          'No overflow: 360,390,768,1199,1200,1440',
          'Draft/internal data hidden',
          'Stale snapshot retained',
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log('UI-F04 targeted browser checks passed');
} finally {
  await page.unrouteAll({ behavior: 'wait' });
  await context.close();
  await browser.close();
}
