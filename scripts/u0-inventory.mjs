import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { extractRoutes } from './u0-route-parser.mjs';
import { routeDisposition, sharedDisposition } from './u0-dispositions.mjs';

const root = process.cwd();
if (
  !root.replaceAll('\\', '/').endsWith('/Credit/.worktrees/astra-production') ||
  execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() !==
    'codex/astra-production'
) {
  throw new Error('Run only in the Astra production worktree');
}
const out = 'docs/reconciliation';
const walkFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walkFiles(name) : [name];
  });
const files = walkFiles('apps/web/src').filter(
  (name) => /\.tsx?$/.test(name) && !/\.(test|spec)\./.test(name),
);
const sources = new Map(files.map((name) => [name, fs.readFileSync(name, 'utf8')]));
const componentFile = (name) =>
  [...sources].find(([, text]) =>
    new RegExp(`export (?:function|const|class) ${name}\\b`).test(text),
  )?.[0] ?? null;
const moduleEvidence = (file) => {
  const text = sources.get(file) ?? '';
  return {
    apiReferencesInModule: [
      ...new Set([...text.matchAll(/['"`]((?:\/api\/)[^'"`\n]+)/g)].map((m) => m[1])),
    ],
    queryRootsInModule: [
      ...new Set([...text.matchAll(/queryKey:\s*\[\s*['"]([^'"]+)/g)].map((m) => m[1])),
    ],
    majorChildrenInModule: [...new Set([...text.matchAll(/<([A-Z][\w]*)/g)].map((m) => m[1]))],
  };
};
const routes = extractRoutes(sources.get('apps/web/src/App.tsx')).map((route) => {
  const file = componentFile(route.component);
  if (!file && route.component !== 'Navigate')
    throw new Error(`Unresolved screen file: ${route.component}`);
  const captured = [
    'ClientHomePage',
    'ClientPlanPage',
    'PublishedCreditCenterPage',
    'ClientAppShell',
  ].includes(route.component);
  return {
    ...route,
    file,
    ...routeDisposition(route),
    ...moduleEvidence(file),
    classificationReview:
      'Disposition reviewed against final owner/spec; product acceptance pending',
    desktop: captured
      ? 'U0 representative browser capture; not accepted'
      : 'Source review only; final browser qualification pending',
    mobile: captured
      ? '390px U0 representative capture; not accepted'
      : 'Source review only; final narrow qualification pending',
  };
});
const shared = files
  .filter((file) => /\/(components|layouts|features)\//.test(file))
  .map((file) => ({
    file,
    exports: [...sources.get(file).matchAll(/export (?:function|const|class) (\w+)/g)].map(
      (m) => m[1],
    ),
    ...sharedDisposition(file),
    ...moduleEvidence(file),
    classificationReview:
      'Module disposition reviewed; exported helpers inherit this treatment unless rationale names an exception',
    desktop: 'Existing source/pass evidence; final composition qualification pending',
    mobile: 'Existing source/pass evidence; final touch/focus/scroll qualification pending',
  }));
const allowed = new Set(['KEEP', 'RESTYLE', 'RECOMPOSE', 'REBUILD', 'RETIRE']);
for (const item of [...routes, ...shared]) {
  if (
    !allowed.has(item.classification) ||
    !item.reason ||
    !item.targetFamily ||
    !/^U\d+$/.test(item.wave)
  ) {
    throw new Error('Invalid reconciliation disposition');
  }
}
fs.writeFileSync(path.join(out, 'route-inventory.json'), JSON.stringify(routes, null, 2) + '\n');
fs.writeFileSync(
  path.join(out, 'shared-component-inventory.json'),
  JSON.stringify(shared, null, 2) + '\n',
);
const esc = (value) => String(value ?? '').replaceAll('|', '/');
const table = (items, keys) =>
  items.map((item) => '| ' + keys.map((key) => esc(item[key])).join(' | ') + ' |').join('\n');
fs.writeFileSync(
  path.join(out, 'UI_SCREEN_COMPONENT_MAP.md'),
  `# Screen/component reconciliation

Baseline: 44a905b; inventory updated from the current route tree. ${routes.length} route declarations and ${shared.length} shared/feature/layout modules have explicit dispositions. Disposition is a migration decision, **not product acceptance**. No KEEP certification is made for existing product screens. RESTYLE on small controlled primitives does not certify every call site.

Sources and detailed missing/embedded/alias decisions: [Portal review](PORTAL_SURFACE_RECONCILIATION.md), [staff review](STAFF_SURFACE_RECONCILIATION.md), [shared review](SHARED_COMPONENT_RECONCILIATION.md). Final Portal section K and latest QA amendments override older navigation and domain assumptions.

[Route JSON](route-inventory.json) and [shared JSON](shared-component-inventory.json) include rationale, file, current API/query discovery, child components and separate desktop/mobile evidence status. Extraction is module-level and may include sibling exports; absence of a literal API URL does not mean no server dependency. Delegated hooks/helpers retain their owning module's authority. Redirect props and authorization wrappers are preserved. New unclassified components fail generation instead of receiving a heuristic default.

## Routes

| Current route | Component | Final owner | Treatment | Wave | Reason |
| --- | --- | --- | --- | --- | --- |
${table(routes, ['route', 'component', 'targetFamily', 'classification', 'wave', 'reason'])}

## Shared/feature/layout modules

| File | Final owner | Treatment | Wave | Reason |
| --- | --- | --- | --- | --- |
${table(shared, ['file', 'targetFamily', 'classification', 'wave', 'reason'])}

Do not remove RETIRE destinations or legacy persistence until the owning wave proves migration and deep-link parity. U0 gate status is recorded in README; generating this file cannot automatically pass it.
`,
);
process.stdout.write(
  JSON.stringify({ routes: routes.length, sharedModules: shared.length, unclassified: 0 }) + '\n',
);
