export type PlanItem = {
  stableKey: string;
  type: 'ACTION' | 'GUIDANCE' | 'MILESTONE';
  completionMode:
    | 'ACKNOWLEDGEMENT'
    | 'STRUCTURED_OUTCOME'
    | 'CLIENT_REPORT_CONSULTANT_VERIFY'
    | 'CONSULTANT_VERIFY'
    | 'SYSTEM_VERIFY';
  owner: 'CLIENT' | 'CONSULTANT' | 'SYSTEM';
  clientTitle: string;
  clientBody: string | null;
  consultantRationale: string | null;
  sortOrder: number;
  required: boolean;
  pathKeys: string[];
  deepLink?: string | null;
  outcomeSchema?: Record<string, unknown> | undefined;
  manuallyProtected?: boolean;
  status?: string;
};
export type Sources = {
  sourceReviewId: string | null;
  sourceReviewVersion: number | null;
  sourceGoalRevisionId: string | null;
  sourceProfileVersion: number | null;
};
export type Dependency = {
  dependentKey: string;
  prerequisiteKey: string;
  groupKey: string;
  mode: 'ALL' | 'ANY';
};
export type Group = {
  dependentKey: string;
  key: string;
  mode: 'ALL' | 'ANY';
  prerequisites: string[];
};
export type PlanPath = {
  key: string;
  clientLabel: string;
  internalLabel: string | null;
  status: 'AVAILABLE' | 'ACTIVE' | 'INACTIVE' | 'RETIRED';
  sortOrder: number;
};
export type PlanDraft = Sources & {
  title: string;
  purpose: string;
  items: PlanItem[];
  paths: PlanPath[];
  groups: Group[];
};
export type BuilderResponse = {
  plan: null | {
    id: string;
    title: string;
    purpose: string;
    status: string;
    versions: Array<
      Sources & {
        id: string;
        title?: string | null;
        purpose?: string | null;
        status: string;
        version: number;
        optimisticVersion: number;
        paths: PlanPath[];
        items: Array<
          Omit<PlanItem, 'pathKeys' | 'outcomeSchema'> & {
            outcomeSchema?: Record<string, unknown> | null;
            pathMemberships: Array<{ path: { key: string } }>;
            prerequisites: Array<{
              prerequisiteItem: { stableKey: string };
              groupKey: string;
              mode: 'ALL' | 'ANY';
            }>;
          }
        >;
      }
    >;
  };
  context: { sources?: Sources };
};
export const hasProgress = (item: PlanItem) =>
  ['COMPLETED', 'AWAITING_VERIFICATION', 'UNABLE', 'IN_PROGRESS', 'CANCELLED'].includes(
    item.status ?? '',
  );
export function draftFromBuilder(data: BuilderResponse): PlanDraft {
  const plan = data.plan;
  const version = plan?.versions[0];
  const groups = new Map<string, Group>();
  for (const item of version?.items ?? [])
    for (const edge of item.prerequisites ?? []) {
      const key = `${item.stableKey}:${edge.groupKey}`;
      const group = groups.get(key) ?? {
        dependentKey: item.stableKey,
        key: edge.groupKey,
        mode: edge.mode,
        prerequisites: [],
      };
      group.prerequisites.push(edge.prerequisiteItem.stableKey);
      groups.set(key, group);
    }
  return {
    title: version?.title ?? plan?.title ?? 'Credit preparation plan',
    purpose: version?.purpose ?? plan?.purpose ?? 'PREPARATION',
    sourceReviewId: version
      ? (version.sourceReviewId ?? null)
      : (data.context.sources?.sourceReviewId ?? null),
    sourceReviewVersion: version?.sourceReviewVersion ?? null,
    sourceGoalRevisionId: version
      ? (version.sourceGoalRevisionId ?? null)
      : (data.context.sources?.sourceGoalRevisionId ?? null),
    sourceProfileVersion: version?.sourceProfileVersion ?? null,
    paths: version?.paths ?? [],
    groups: [...groups.values()],
    items: (version?.items ?? []).map((item) => ({
      ...item,
      outcomeSchema: item.outcomeSchema ?? undefined,
      pathKeys: item.pathMemberships.map(({ path }) => path.key),
    })),
  };
}
export function draftPayload(draft: PlanDraft) {
  const { groups, ...rest } = draft;
  return {
    ...rest,
    items: rest.items.map((item, sortOrder) => ({
      stableKey: item.stableKey,
      type: item.type,
      completionMode: item.completionMode,
      owner: item.owner,
      clientTitle: item.clientTitle,
      clientBody: item.clientBody,
      consultantRationale: item.consultantRationale,
      required: item.required,
      deepLink: item.deepLink,
      outcomeSchema: item.outcomeSchema,
      manuallyProtected: item.manuallyProtected,
      pathKeys: item.pathKeys,
      sortOrder,
    })),
    dependencies: groups.flatMap((group) =>
      group.prerequisites.map((prerequisiteKey): Dependency => ({
        dependentKey: group.dependentKey,
        prerequisiteKey,
        groupKey: group.key,
        mode: group.mode,
      })),
    ),
  };
}
export function editorIssues(draft: PlanDraft) {
  const issues: string[] = [];
  if (!draft.title.trim()) issues.push('Give the Plan a title.');
  if (!draft.items.length) issues.push('Add at least one step.');
  if (draft.items.some((item) => !item.clientTitle.trim()))
    issues.push('Give every step a client-facing title.');
  const outgoing = new Map<string, string[]>();
  for (const edge of draftPayload(draft).dependencies)
    outgoing.set(edge.dependentKey, [
      ...(outgoing.get(edge.dependentKey) ?? []),
      edge.prerequisiteKey,
    ]);
  const visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (done.has(id)) return false;
    visiting.add(id);
    if ((outgoing.get(id) ?? []).some(visit)) return true;
    visiting.delete(id);
    done.add(id);
    return false;
  };
  if (draft.items.some((item) => visit(item.stableKey)))
    issues.push(
      'These prerequisites form a loop. Remove a dependency so every step can be reached.',
    );
  return issues;
}
