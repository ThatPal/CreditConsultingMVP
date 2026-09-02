export type PlanGraphItem = {
  id: string;
  type: 'ACTION' | 'GUIDANCE' | 'MILESTONE';
  completionMode:
    | 'ACKNOWLEDGEMENT'
    | 'STRUCTURED_OUTCOME'
    | 'CLIENT_REPORT_CONSULTANT_VERIFY'
    | 'CONSULTANT_VERIFY'
    | 'SYSTEM_VERIFY';
  required: boolean;
  pathKeys: string[];
};

export type PlanGraphDependency = {
  dependentItemId: string;
  prerequisiteItemId: string;
  groupKey: string;
  mode: 'ALL' | 'ANY';
};

export type PlanValidationIssue = {
  code: string;
  itemId?: string;
  message: string;
};

const allowedCompletionModes: Record<PlanGraphItem['type'], Set<PlanGraphItem['completionMode']>> = {
  ACTION: new Set([
    'ACKNOWLEDGEMENT',
    'STRUCTURED_OUTCOME',
    'CLIENT_REPORT_CONSULTANT_VERIFY',
    'CONSULTANT_VERIFY',
    'SYSTEM_VERIFY',
  ]),
  GUIDANCE: new Set(['ACKNOWLEDGEMENT']),
  MILESTONE: new Set(['CONSULTANT_VERIFY', 'SYSTEM_VERIFY']),
};

export function validatePlanGraph(input: {
  items: PlanGraphItem[];
  dependencies: PlanGraphDependency[];
  activePathKeys?: string[];
}) {
  const issues: PlanValidationIssue[] = [];
  const itemById = new Map(input.items.map((item) => [item.id, item]));
  const outgoing = new Map<string, string[]>();

  for (const item of input.items) {
    if (!allowedCompletionModes[item.type].has(item.completionMode))
      issues.push({
        code: 'INVALID_COMPLETION_MODE',
        itemId: item.id,
        message: `${item.type} cannot use ${item.completionMode}.`,
      });
  }

  for (const edge of input.dependencies) {
    if (!itemById.has(edge.dependentItemId) || !itemById.has(edge.prerequisiteItemId)) {
      issues.push({ code: 'MISSING_REFERENCE', message: 'A dependency references a missing item.' });
      continue;
    }
    if (edge.dependentItemId === edge.prerequisiteItemId) {
      issues.push({
        code: 'SELF_DEPENDENCY',
        itemId: edge.dependentItemId,
        message: 'An item cannot depend on itself.',
      });
      continue;
    }
    const dependent = itemById.get(edge.dependentItemId)!;
    const prerequisite = itemById.get(edge.prerequisiteItemId)!;
    if (
      dependent.pathKeys.length &&
      prerequisite.pathKeys.length &&
      !dependent.pathKeys.some((key) => prerequisite.pathKeys.includes(key))
    )
      issues.push({
        code: 'INVALID_CROSS_PATH_DEPENDENCY',
        itemId: dependent.id,
        message: 'A dependency cannot require an item that is unreachable on the same path.',
      });
    outgoing.set(edge.prerequisiteItemId, [
      ...(outgoing.get(edge.prerequisiteItemId) ?? []),
      edge.dependentItemId,
    ]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of outgoing.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const item of input.items) {
    if (visit(item.id)) {
      issues.push({ code: 'CIRCULAR_DEPENDENCY', message: 'The dependency graph contains a cycle.' });
      break;
    }
  }

  const activePaths = new Set(input.activePathKeys ?? []);
  if (activePaths.size > 1)
    issues.push({
      code: 'DUPLICATE_ACTIVE_PATH',
      message: 'Only one governed alternative path may be active at a time.',
    });
  for (const item of input.items) {
    if (item.required && item.pathKeys.length && !item.pathKeys.some((key) => activePaths.has(key)))
      issues.push({
        code: 'UNREACHABLE_REQUIRED_ITEM',
        itemId: item.id,
        message: 'A required item is not reachable through the active path.',
      });
  }

  return { valid: issues.length === 0, issues };
}

export function prerequisitesSatisfied(
  itemId: string,
  dependencies: PlanGraphDependency[],
  completedItemIds: ReadonlySet<string>,
) {
  const groups = new Map<string, PlanGraphDependency[]>();
  for (const edge of dependencies.filter((dependency) => dependency.dependentItemId === itemId))
    groups.set(edge.groupKey, [...(groups.get(edge.groupKey) ?? []), edge]);
  return [...groups.values()].every((group) =>
    group[0]?.mode === 'ANY'
      ? group.some((edge) => completedItemIds.has(edge.prerequisiteItemId))
      : group.every((edge) => completedItemIds.has(edge.prerequisiteItemId)),
  );
}
