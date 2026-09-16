import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { extractRoutes } from './u0-route-parser.mjs';
import { routeDisposition, sharedDisposition } from './u0-dispositions.mjs';

test('every real route and shared module has an explicit owner, treatment and wave', () => {
  const routes = extractRoutes(fs.readFileSync('apps/web/src/App.tsx', 'utf8'));
  const shared = JSON.parse(
    fs.readFileSync('docs/reconciliation/shared-component-inventory.json', 'utf8'),
  );
  assert.equal(routes.length, 120);
  assert.equal(shared.length, 47);
  for (const row of [
    ...routes.map(routeDisposition),
    ...shared.map((item) => sharedDisposition(item.file)),
  ]) {
    assert.ok(row.targetFamily && row.reason && row.classification);
    assert.match(row.wave, /^U\d+$/);
  }
});

test('role/view variants retain their correct final owner', () => {
  const rows = extractRoutes(fs.readFileSync('apps/web/src/App.tsx', 'utf8'));
  const owner = (route) => routeDisposition(rows.find((r) => r.route === route)).targetFamily;
  assert.equal(owner('/admin/security-events'), 'ADMIN-24');
  assert.equal(owner('/admin/audit-events'), 'ADMIN-23');
  assert.equal(owner('/crm/live-sessions/:sessionId'), 'CRM-19');
  assert.equal(owner('/app/rounds/:roundId/live'), 'CP-RD-04');
  assert.equal(owner('/app/credit-center/profile'), 'CP-CC-09');
});

test('new unreviewed components and unsupported authority variants fail closed', () => {
  assert.throws(() => routeDisposition({ component: 'NewPage' }), /Unclassified/);
  assert.throws(() => sharedDisposition('new-component.tsx'), /Unclassified/);
  assert.throws(
    () =>
      routeDisposition({
        component: 'AdminEventListPage',
        props: { kind: 'unknown' },
        route: '/admin/new',
      }),
    /Unknown Admin event authority/,
  );
});
