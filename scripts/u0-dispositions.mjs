import fs from 'node:fs';
import path from 'node:path';

const read = (file) =>
  JSON.parse(fs.readFileSync(new URL(`../docs/reconciliation/${file}`, import.meta.url), 'utf8'));
const routes = read('route-dispositions.json');
const shared = read('shared-dispositions.json');
export function routeDisposition(row) {
  if (row.component === 'Navigate') {
    if (row.route === '/')
      return {
        targetFamily: 'Public acquisition',
        classification: 'REBUILD',
        wave: 'U9',
        reason: 'Root currently redirects to intake; final public experience is missing.',
      };
    if (row.route === '/*')
      return {
        targetFamily: 'Global not-found / auth recovery',
        classification: 'RECOMPOSE',
        wave: 'U1',
        reason: 'Unknown path should explain recovery rather than silently masquerade as login.',
      };
    return {
      targetFamily: `Compatibility alias to ${row.redirectTo}`,
      classification: 'RETIRE',
      wave: 'U9',
      reason:
        'Retire old navigation ownership; retain authorized redirect compatibility until destination parity is proved. No deletion in U0.',
    };
  }
  const base = routes[row.component];
  if (!base) throw new Error(`Unclassified route component: ${row.component}`);
  const result = { ...base };
  if (row.component === 'PublishedCreditCenterPage')
    result.targetFamily =
      {
        overview: 'CP-CC-01',
        profile: 'CP-CC-09',
        report: 'CP-CC-06',
        analysis: 'CP-CC-10',
        history: 'CP-CC-03/04',
      }[row.props.view] ?? base.targetFamily;
  if (row.component === 'MajorReadinessPage')
    result.targetFamily =
      {
        readiness: 'CP-MR-02',
        preparation: 'CP-MR-03',
        coordination: 'CP-MR-04',
        timeline: 'CP-MR-05',
      }[row.props.view] ?? 'CP-MR-01/06';
  if (row.component === 'AdminEventListPage' || row.component === 'AdminEventDetailPage') {
    if (!['audit', 'security'].includes(row.props.kind))
      throw new Error('Unknown Admin event authority');
    result.targetFamily = row.props.kind === 'audit' ? 'ADMIN-23' : 'ADMIN-24';
  }
  if (row.route.startsWith('/crm/')) {
    if (row.component === 'ExploreCardsPage') result.targetFamily = 'CRM-24';
    if (row.component === 'LiveSessionPage') result.targetFamily = 'CRM-19';
    if (['PostRoundPage', 'RoundAnalysisPage', 'RoundFinalizationPage'].includes(row.component))
      result.targetFamily = 'CRM-20';
    if (row.component === 'SecurityPage') result.targetFamily = 'CRM-28 Security';
  }
  return result;
}

export function sharedDisposition(file) {
  const result = shared[path.basename(file)];
  if (!result) throw new Error(`Unclassified shared module: ${file}`);
  return result;
}
