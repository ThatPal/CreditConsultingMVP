import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root = process.cwd();
if (
  !root.replaceAll('\\', '/').endsWith('/Credit/.worktrees/astra-production') ||
  execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() !==
    'codex/astra-production'
) {
  throw new Error('Run only in the Astra production worktree');
}
const out = 'docs/reconciliation';
fs.mkdirSync(out, { recursive: true });
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
const patterns = [
  [/^ClientHomePage$/, 'CP-01', 'U1', 'RECOMPOSE'],
  [/^ClientAppShell$/, 'CP-SHELL-01', 'U1', 'RECOMPOSE'],
  [/^ClientJourneyPage$/, 'PORTAL-02 Journey', 'U1', 'REBUILD'],
  [/^ClientPlanPage$/, 'CP-PL-01 / CP-AC-01 / CP-AC-02', 'U1', 'RECOMPOSE'],
  [/^PublishedCreditCenterPage$/, 'CP-CC-01/03/06/09/10', 'U1', 'REBUILD'],
  [
    /Auth|Login|Register|Password|Email|Mfa|Security|Account/,
    'Auth / account / security',
    'U2',
    'RESTYLE',
  ],
  [/Goals|GoalIntake/, 'Goals / onboarding', 'U4', 'REBUILD'],
  [/ClientReview|ConsultantReview/, 'CP-CC / CRM-11 Review', 'U3', 'REBUILD'],
  [/ConsultantClientCreditCenter/, 'CRM-06', 'U3', 'RECOMPOSE'],
  [/ConsultantPlanBuilder/, 'CRM-12', 'U4', 'RECOMPOSE'],
  [/Card|Catalog|Insight/, 'Cards / catalog / research', 'U5', 'REBUILD'],
  [
    /Strategy|Live|Calendar|Appointment|Schedule|SeasonalCycle|^RoundPage|MajorApplicationCheck/,
    'Round / strategy / live / appointment',
    'U6',
    'REBUILD',
  ],
  [
    /PostRound|RoundAnalysis|RoundFinalization|MajorReadiness/,
    'Post-Round / Major Readiness',
    'U7',
    'REBUILD',
  ],
  [
    /Services|ServiceDetail|Purchase|Checkout|Payment|PayPal|Stripe|Bofa/,
    'Services / commerce / gateways',
    'U7',
    'RECOMPOSE',
  ],
  [/AdminUser|AdminAccess/, 'ADMIN-02/03/04', 'U2', 'RECOMPOSE'],
  [/Admin|SystemHealth/, 'Admin operational surfaces', 'U8', 'RECOMPOSE'],
  [/ConsultantDashboard|WorkQueue|ClientsPage|Client360/, 'CRM-01/02/03/04', 'U8', 'RECOMPOSE'],
  [/Support|Documents|Notifications/, 'Support / Documents / Notifications', 'U8', 'RECOMPOSE'],
  [/Readiness/, 'Legacy readiness → owning Review/Plan/Round', 'U4', 'RETIRE'],
  [/Navigate|FoundationPage/, 'Route alias / safe fallback', 'U9', 'KEEP'],
  [/DesignSystem|ShellEvidence/, 'Development-only evidence', 'U1', 'RESTYLE'],
];
const source = sources.get('apps/web/src/App.tsx');
const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const routes = [];
function walk(node, prefix = '') {
  const element = ts.isJsxElement(node)
    ? node.openingElement
    : ts.isJsxSelfClosingElement(node)
      ? node
      : null;
  let next = prefix;
  if (element?.tagName.getText(ast) === 'Route') {
    const attrs = element.attributes.properties;
    const p = attrs.find((a) => a.name?.getText(ast) === 'path')?.initializer;
    const isIndex = attrs.some((a) => a.name?.getText(ast) === 'index');
    if (p && ts.isStringLiteral(p)) next = p.text.startsWith('/') ? p.text : `${prefix}/${p.text}`;
    if (p || isIndex) {
      const jsx =
        attrs.find((a) => a.name?.getText(ast) === 'element')?.initializer?.getText(ast) ?? '';
      const names = [...jsx.matchAll(/<([A-Z][\w]*)/g)]
        .map((m) => m[1])
        .filter((n) => n !== 'Suspense');
      const component = names[0] ?? '';
      const file = componentFile(component);
      const text = sources.get(file) ?? '';
      const match = patterns.find(([pattern]) => pattern.test(component));
      routes.push({
        route: next || '/',
        component,
        file,
        line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
        targetFamily: match?.[1] ?? 'Pending final family review',
        wave: match?.[2] ?? 'U8',
        proposedClassification: match?.[3] ?? 'RECOMPOSE',
        classificationReview: 'PROVISIONAL — requires per-surface final-spec validation',
        apiReferencesInModule: [
          ...new Set([...text.matchAll(/['"`]((?:\/api\/)[^'"`\n]+)/g)].map((m) => m[1])),
        ],
        majorChildrenInModule: [...new Set([...text.matchAll(/<([A-Z][\w]*)/g)].map((m) => m[1]))],
        desktop: [
          'ClientHomePage',
          'ClientPlanPage',
          'PublishedCreditCenterPage',
          'ClientAppShell',
        ].includes(component)
          ? 'U0 captured representative state; not accepted'
          : 'Not requalified in U0',
        mobile: [
          'ClientHomePage',
          'ClientPlanPage',
          'PublishedCreditCenterPage',
          'ClientAppShell',
        ].includes(component)
          ? '390px representative capture; not accepted'
          : 'Not requalified in U0',
      });
    }
  }
  ts.forEachChild(node, (child) => walk(child, next));
}
walk(ast);
fs.writeFileSync(path.join(out, 'route-inventory.json'), JSON.stringify(routes, null, 2) + '\n');
const shared = files
  .filter((f) => /\/(components|layouts|features)\//.test(f))
  .map((file) => ({
    file,
    exports: [...sources.get(file).matchAll(/export (?:function|const|class) (\w+)/g)].map(
      (m) => m[1],
    ),
    status: 'Awaiting final component-by-component classification',
  }));
fs.writeFileSync(
  path.join(out, 'shared-component-inventory.json'),
  JSON.stringify(shared, null, 2) + '\n',
);
const esc = (value) => String(value ?? '').replaceAll('|', '/');
fs.writeFileSync(
  path.join(out, 'UI_SCREEN_COMPONENT_MAP.md'),
  `# Screen/component reconciliation — inventory checkpoint\n\nBaseline: 44a905b. Generated from the current TypeScript route tree, not the old audit CSV. ${routes.length} route declarations; ${shared.length} shared/feature/layout modules.\n\n**U0 mapping acceptance is pending.** Classifications below are proposed migration treatments, not certified KEEP decisions. The U1 reference slice has source/browser evidence in U1_TRUTH_MAP and U1_VISUAL_BASELINE. All other rows require final exact-spec review before implementation. Module-level API/child extraction may include siblings exported by that module; it is discovery evidence, not a per-render dependency graph.\n\n[Route details](route-inventory.json) include implementation files, current API references, major child components, desktop/mobile evidence and review status. [Shared modules](shared-component-inventory.json) provide the full component review queue. Missing final surfaces and duplicate aliases must be resolved against the final coverage register before U0 passes.\n\n| Current route | Component | Final family | Proposed treatment | Wave |\n| --- | --- | --- | --- | --- |\n${routes.map((r) => `| ${esc(r.route)} | ${esc(r.component)} | ${esc(r.targetFamily)} | ${r.proposedClassification} | ${r.wave} |`).join('\n')}\n\n## Confirmed reference-slice gaps\n\n- Dedicated Action list/detail routes are absent; current response UI is embedded in Plan. Target CP-AC-01/02 is MISSING as a separate canonical navigation surface. Preserve response controls when introducing it.\n- Plan Overview/Decisions/Nurture views are absent; current Plan page lists one selected published Plan.\n- Final Credit Center DTO composition/currentness/Plan connection is absent. Existing Profile/Analysis/History routes are implementation material.\n- Final primary navigation lacks Credit Plan and still elevates legacy service destinations.\n- Public marketing remains absent at the root; root redirects to intake.\n\nDo not delete aliases or legacy screens until replacement behavior and deep-link compatibility are proved.\n`,
);
process.stdout.write(
  JSON.stringify({ routes: routes.length, sharedModules: shared.length }) + '\n',
);
