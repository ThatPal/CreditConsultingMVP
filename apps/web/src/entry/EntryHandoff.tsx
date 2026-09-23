import { useNavigationProtection } from '../NavigationProtection';
import { readEntryDecision, writeEntryDecision, clearEntryDecision } from './decisionRecovery';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Alert, Button, Stack } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type {
  IntakeLocator,
  IntakePreview,
  IntakeResolve,
  GoalResolutionReference,
  PendingIntake,
} from '@credit/shared';
import { creditWorkspaceKeys } from '../queries/creditWorkspace';
import { useAuth } from '../auth/AuthProvider';
import { ApiRequestError, apiRequest } from '../auth/api';
import { expectedActorHeaders } from '../auth/requestActor';
import { subscribeToSessionLoss } from '../auth/sessionLoss';
import { forgetIntake, entryClientReturn } from './continuation';
import {
  EntryRecovery,
  type EntryRecoveryKind,
  GoalIntakeDecision,
  GoalResolutionFeedback,
  PendingIntakeList,
} from './EntryComponents';

export function EntryHandoff() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const selected = params.get('intake') ?? params.get('intakeClaim');
  const selectionId = useMemo(() => crypto.randomUUID(), [selected]);
  if (!user?.clientId) return null;
  return (
    <Handoff
      key={`${user.userId}:${user.clientId}:${selectionId}`}
      actorId={user.userId}
      clientId={user.clientId}
      account={user.email}
    />
  );
}
function Handoff({
  actorId,
  clientId,
  account,
}: {
  actorId: string;
  clientId: string;
  account: string;
}) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [locator] = useState<IntakeLocator | null>(() =>
    params.get('intake')
      ? { kind: 'TOKEN', value: params.get('intake')! }
      : params.get('intakeClaim')
        ? { kind: 'CLAIM', id: params.get('intakeClaim')! }
        : null,
  );
  const [preview, setPreview] = useState<IntakePreview | null>(null);
  const [pending, setPending] = useState<PendingIntake[]>([]);
  const [resolution, setResolution] = useState<GoalResolutionReference | null>(null);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<EntryRecoveryKind>('SIGNED_IN_RECOVERY');
  const classify = (cause: unknown): EntryRecoveryKind =>
    cause instanceof ApiRequestError
      ? ((
          {
            INTAKE_EXPIRED: 'EXPIRED',
            INTAKE_UNAVAILABLE: 'UNAVAILABLE',
            STALE_INTAKE: 'STALE',
            STALE_GOAL_CONTEXT: 'STALE',
            INTAKE_ALREADY_RESOLVED: 'ALREADY_RESOLVED',
            LEGACY_RESOLUTION_UNAVAILABLE: 'LEGACY_OUTCOME_UNAVAILABLE',
            AUTH_REQUIRED: 'AUTH_FAILURE',
          } as Record<string, EntryRecoveryKind>
        )[cause.code] ?? 'SIGNED_IN_RECOVERY')
      : 'SIGNED_IN_RECOVERY';
  const [state, setState] = useState<'idle' | 'busy' | 'uncertain'>('idle');
  const [storageFailed, setStorageFailed] = useState(false);
  useNavigationProtection(state !== 'idle', state === 'busy');
  const active = useRef(true);
  const command = useRef<{ key: string; body: IntakeResolve } | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    active.current = true;
    const off = subscribeToSessionLoss(() => {
      active.current = false;
      generation.current++;
      setPreview(null);
      setPending([]);
      setResolution(null);
      command.current = null;
    });
    return () => {
      active.current = false;
      generation.current++;
      off();
    };
  }, []);
  async function load() {
    const request = ++generation.current;
    setError('');
    try {
      if (locator) {
        const view = await apiRequest<IntakePreview>('/api/v1/client/goal-intakes/preview', {
          method: 'POST',
          body: JSON.stringify({ locator }),
        });
        if (
          !active.current ||
          request !== generation.current ||
          view.actorId !== actorId ||
          view.clientId !== clientId
        )
          return;
        setPreview(view);
        if (view.resolution) {
          clearEntryDecision(actorId, clientId, view.intakeId);
          setResolution(view.resolution);
        } else {
          const restored = readEntryDecision(actorId, clientId, view.intakeId);
          if (restored) {
            const { key, intakeId, ...body } = restored;
            void intakeId;
            command.current = { key, body: { ...body, locator } };
            setState('uncertain');
          }
        }
      } else {
        const result = await apiRequest<{ entries: PendingIntake[] }>(
          '/api/v1/client/goal-intakes/pending',
        );
        if (!Array.isArray(result.entries))
          throw new Error('Saved goals are temporarily unavailable');
        if (active.current && request === generation.current) setPending(result.entries);
      }
    } catch (cause) {
      if (active.current) setErrorKind(classify(cause));
      if (active.current && request === generation.current)
        setError(cause instanceof Error ? cause.message : 'Saved goals could not be loaded');
    }
  }
  useEffect(() => {
    void load();
  }, []); // Selection/account changes remount this boundary.
  function leave() {
    forgetIntake();
    navigate(entryClientReturn(params.get('returnTo')), { replace: true });
  }
  async function send(decision?: IntakeResolve['decision']) {
    if (
      !active.current ||
      expectedActorHeaders('/api/v1/client/goal-intakes/resolve')['X-Credit-Actor'] !== actorId
    )
      return;
    if (!command.current && preview && locator && decision)
      command.current = {
        key: crypto.randomUUID(),
        body: {
          locator,
          decision,
          expectedIntakeVersion: preview.intakeVersion,
          expectedGoalSetVersion: preview.goalSetVersion,
          expectedCurrentGoal: preview.currentGoal
            ? { id: preview.currentGoal.id, version: preview.currentGoal.version }
            : null,
        },
      };
    const attempt = command.current;
    if (!attempt) return;
    if (preview) {
      const { locator: savedLocator, ...savedBody } = attempt.body;
      void savedLocator;
      setStorageFailed(
        !writeEntryDecision(actorId, clientId, {
          ...savedBody,
          key: attempt.key,
          intakeId: preview.intakeId,
        }),
      );
    }
    setState('busy');
    setError('');
    try {
      const result = await apiRequest<{ resolution: GoalResolutionReference }>(
        '/api/v1/client/goal-intakes/resolve',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': attempt.key },
          body: JSON.stringify(attempt.body),
        },
      );
      if (!active.current) return;
      clearEntryDecision(actorId, clientId, result.resolution.intakeId);
      setResolution(result.resolution);
      setState('idle');
      command.current = null;
      forgetIntake();
      await Promise.all(
        [['goals'], creditWorkspaceKeys.home(), creditWorkspaceKeys.journey()].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    } catch (cause) {
      if (active.current) setErrorKind(classify(cause));
      if (!active.current) return;
      setError(
        cause instanceof Error ? cause.message : 'The decision outcome could not be confirmed',
      );
      if (
        cause instanceof ApiRequestError &&
        cause.status < 500 &&
        cause.code !== 'IDEMPOTENCY_IN_PROGRESS'
      ) {
        if (preview) clearEntryDecision(actorId, clientId, preview.intakeId);
        command.current = null;
        setPreview(null);
        setState('idle');
      } else setState('uncertain');
    }
  }
  if (resolution) return <GoalResolutionFeedback resolution={resolution} onContinue={leave} />;
  if (state === 'uncertain')
    return (
      <Alert severity="warning">
        The outcome is not confirmed. Retry the same decision before making another choice.
        {storageFailed &&
          ' Recovery could not be stored in this tab. Keep this page open until the result is confirmed.'}
        <Button onClick={() => void send()}>Retry same decision</Button>
      </Alert>
    );
  if (error)
    return (
      <EntryRecovery
        message={`You are signed in, but this saved goal could not be continued. ${error}`}
        kind={errorKind}
        requestState={state === 'busy' ? 'BUSY' : 'IDLE'}
        actions={{
          continueWithout: leave,
          ...(['EXPIRED', 'UNAVAILABLE', 'LEGACY_OUTCOME_UNAVAILABLE'].includes(errorKind)
            ? {}
            : { retry: () => void load() }),
          ...(locator?.kind === 'TOKEN' && errorKind !== 'EXPIRED'
            ? { back: () => navigate('/goal-intake?intake=' + encodeURIComponent(locator.value)) }
            : {}),
        }}
      />
    );
  if (preview)
    return (
      <GoalIntakeDecision
        preview={preview}
        account={account}
        commandState={state === 'busy' ? 'SUBMITTING' : 'IDLE'}
        onResolve={(decision) => void send(decision)}
        onNotNow={leave}
        onRefresh={() => void load()}
        onViewGoals={() => navigate('/app/goals', { replace: true })}
      />
    );
  if (locator)
    return (
      <Alert severity="info" role="status">
        Loading your saved goal comparison…
      </Alert>
    );
  return (
    <Stack>
      <PendingIntakeList
        entries={pending}
        onSelect={(id) => {
          const next = new URLSearchParams(params);
          next.set('intakeClaim', id);
          setParams(next);
        }}
      />
    </Stack>
  );
}
