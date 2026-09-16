import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractRoutes } from './u0-route-parser.mjs';

test('nested routes preserve guards, index identity, props and redirect destination', () => {
  const rows = extractRoutes(`<Routes><Route element={<ProtectedRoute roles={['CLIENT']} />}>
    <Route path="/app" element={<Shell />}><Route index element={<Home />} />
    <Route path="profile" element={<Profile view="history" />} /></Route>
    </Route><Route path="/old" element={<Navigate to="/app" replace />} /></Routes>`);
  assert.deepEqual(
    rows.map((r) => [r.route, r.index, r.component]),
    [
      ['/app', false, 'Shell'],
      ['/app', true, 'Home'],
      ['/app/profile', false, 'Profile'],
      ['/old', false, 'Navigate'],
    ],
  );
  assert.equal(rows[2].props.view, 'history');
  assert.equal(rows[2].guards[0].component, 'ProtectedRoute');
  assert.equal(rows[3].redirectTo, '/app');
  assert.deepEqual(rows[3].guards, []);
});

test('fallback and attribute JSX cannot replace the rendered lazy screen', () => {
  const rows = extractRoutes(`<Route path="/plan" element={<Suspense fallback={<LoadingSkeleton />}>
    <><Suspense fallback={<OtherFallback />}><Plan preview={<Preview />} /></Suspense></>
    </Suspense>} />`);
  assert.equal(rows[0].component, 'Plan');
});

test('unsupported dynamic routes fail visibly instead of disappearing from the audit', () => {
  assert.throws(
    () => extractRoutes('<Route path={dynamicPath} element={<Screen />} />'),
    /Dynamic route/,
  );
  assert.throws(
    () => extractRoutes('<Route path="/x" element={enabled ? <A /> : <B />} />'),
    /Unresolved route/,
  );
});

test('actual application includes Plan Builder and distinct audit/security variants', () => {
  const rows = extractRoutes(readFileSync('apps/web/src/App.tsx', 'utf8'));
  assert.equal(rows.length, 120);
  assert.equal(
    rows.find((r) => r.route === '/crm/clients/:clientId/plan').component,
    'ConsultantPlanBuilderPage',
  );
  assert.equal(rows.find((r) => r.route === '/dev/design-system').component, 'DesignSystemPage');
  assert.equal(rows.find((r) => r.route === '/dev/shell/:role').component, 'ShellEvidencePage');
  assert.equal(rows.find((r) => r.route === '/admin/audit-events').props.kind, 'audit');
  assert.equal(rows.find((r) => r.route === '/admin/security-events').props.kind, 'security');
  assert.ok(rows.every((r) => r.component !== 'LoadingSkeleton'));
});
