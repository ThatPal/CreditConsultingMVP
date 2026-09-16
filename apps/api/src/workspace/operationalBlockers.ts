// U1 read-only projection over existing U6 Round/Live/Major sources.
export function operationalBlockers(input: {
  round?: { id: string; status: string; strategy: { status: string } | null } | null;
  liveSession?: { id: string; roundId: string; status: string; version: number } | null;
  restrictions: Array<{ id: string; caseId: string; decisionId: string; scope: string }>;
}) {
  const result: Array<{
    code: string;
    scope: string;
    owner: 'CONSULTANT';
    title: string;
    message: string;
    href: string;
    source: { type: string; id: string; version?: number };
  }> = [];
  const names: Record<string, string> = {
    CYCLE: 'Application cycle',
    STRATEGY: 'Strategy preparation',
    SCHEDULING: 'Session scheduling',
    LIVE_EXECUTION: 'Live application activity',
  };
  for (const restriction of input.restrictions)
    result.push({
      code: 'MAJOR_RESTRICTION',
      scope: restriction.scope,
      owner: 'CONSULTANT',
      title: names[restriction.scope] ?? 'Credit activity',
      message:
        'Your consultant must resolve this coordination restriction before this activity can continue.',
      href: '/app/major-readiness/coordination?caseId=' + encodeURIComponent(restriction.caseId),
      source: { type: 'CreditActivityRestriction', id: restriction.id },
    });
  if (input.round?.status === 'BLOCKED')
    result.push({
      code: 'ROUND_BLOCKED',
      scope: 'ROUND_EXECUTION',
      owner: 'CONSULTANT',
      title: 'Application round',
      message: 'Your round needs consultant review before applications can continue.',
      href: '/app/rounds/' + encodeURIComponent(input.round.id),
      source: { type: 'CreditCardRound', id: input.round.id },
    });
  if (input.round?.strategy?.status === 'STALE')
    result.push({
      code: 'STRATEGY_STALE',
      scope: 'ROUND_EXECUTION',
      owner: 'CONSULTANT',
      title: 'Strategy update',
      message: 'Your strategy needs review after its source information changed.',
      href: '/app/rounds/' + encodeURIComponent(input.round.id),
      source: { type: 'CreditCardRound', id: input.round.id },
    });
  if (input.liveSession && ['PAUSED', 'WAITING_FOR_CONSULTANT'].includes(input.liveSession.status))
    result.push({
      code: 'LIVE_WAITING',
      scope: 'LIVE_EXECUTION',
      owner: 'CONSULTANT',
      title: 'Application session',
      message:
        input.liveSession.status === 'PAUSED'
          ? 'Your session is paused. Wait for your consultant before continuing applications.'
          : 'Your session is waiting for your consultant.',
      href: '/app/rounds/' + encodeURIComponent(input.liveSession.roundId) + '/live',
      source: {
        type: 'ApplicationSession',
        id: input.liveSession.id,
        version: input.liveSession.version,
      },
    });
  return result;
}
