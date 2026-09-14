import { PlanLifecyclePreview } from './PlanLifecyclePreview';
import { PlanConflictResolution } from './PlanConflictResolution';
import { PlanDraftComparison } from './PlanDraftComparison';
import { useAuth } from '../../auth/AuthProvider';
import { planRecoveryKey } from '../../auth/tabRecovery';
import { useNavigationProtection } from '../../NavigationProtection';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../../auth/api';
import { PageHeader } from '../../components/common/PageHeader';
import { PlanExecutionReview } from './PlanExecutionReview';
import { ResponseSchemaEditor } from './ResponseSchemaEditor';
import { RecoveryState } from '../../components/common/InteractionPatterns';
import {
  draftFromBuilder,
  draftPayload,
  editorIssues,
  hasProgress,
  type BuilderResponse,
  type PlanDraft,
  type PlanItem,
} from './editor';

type SourcePreview = {
  fingerprint: string;
  changed: boolean;
  expectedVersion: number;
  hasPublishedPlan: boolean;
  changes: Array<{ field: string; label: string; before: string; after: string; changed: boolean }>;
  keptSteps: Array<{ title: string; status: string }>;
};
type Editor = {
  draft: PlanDraft;
  baseline: string;
  revision: number;
  planId: string | null;
  status: string;
  version: number;
};
const hydrate = (data: BuilderResponse): Editor => {
  const draft = draftFromBuilder(data);
  return {
    draft,
    baseline: JSON.stringify(draftPayload(draft)),
    revision: data.plan?.versions[0]?.optimisticVersion ?? 0,
    planId: data.plan?.id ?? null,
    status: data.plan?.versions[0]?.status ?? data.plan?.status ?? 'NEW',
    version: data.plan?.versions[0]?.version ?? 1,
  };
};
const purposes = {
  PREPARATION: 'Credit preparation',
  NURTURE: 'Ongoing preparation',
  POST_ROUND: 'After an application round',
  MAJOR_READINESS: 'Major financing preparation',
};
const completionLabels = {
  ACKNOWLEDGEMENT: 'Client acknowledges',
  STRUCTURED_OUTCOME: 'Client submits a structured response',
  CLIENT_REPORT_CONSULTANT_VERIFY: 'Client reports; consultant verifies',
  CONSULTANT_VERIFY: 'Consultant verifies',
  SYSTEM_VERIFY: 'Automated verification',
};
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'The request could not be completed. Your edits are still here.';

export function ConsultantPlanBuilderPage() {
  const { clientId = '' } = useParams();
  const { user } = useAuth();
  return user ? (
    <PlanBuilder key={`${user.userId}:${clientId}`} clientId={clientId} actorId={user.userId} />
  ) : null;
}

function PlanBuilder({ clientId, actorId }: { clientId: string; actorId: string }) {
  const recoveryKey = planRecoveryKey(actorId, clientId);
  const [recovery, setRecovery] = useState<Editor | null>(() => {
    try {
      const raw = sessionStorage.getItem(recoveryKey);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (
        saved.format !== 1 ||
        typeof saved.savedAt !== 'number' ||
        !Number.isFinite(saved.savedAt) ||
        saved.savedAt > Date.now() ||
        Date.now() - saved.savedAt > 24 * 60 * 60 * 1000
      )
        return null;
      const value = saved.editor as Editor;
      if (
        typeof value.baseline !== 'string' ||
        !Number.isInteger(value.revision) ||
        !Number.isInteger(value.version) ||
        typeof value.status !== 'string' ||
        !(value.planId === null || typeof value.planId === 'string')
      )
        return null;
      // Exercise the normal draft readers before offering data from browser storage.
      draftPayload(value.draft);
      editorIssues(value.draft);
      return value;
    } catch {
      return null;
    }
  });
  const [recoveryError, setRecoveryError] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['plan-builder', clientId],
    queryFn: () => apiRequest<BuilderResponse>(`/api/v1/consultant/clients/${clientId}/plan`),
    enabled: Boolean(clientId),
  });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const editorRef = useRef(editor);
  editorRef.current = editor;
  useEffect(() => {
    if (!query.data) return;
    const previous = editorRef.current;
    // Realtime/refocus must never silently replace local unsaved work.
    if (!previous || JSON.stringify(draftPayload(previous.draft)) === previous.baseline)
      setEditor(hydrate(query.data));
  }, [query.data]);
  const dirty = Boolean(editor && JSON.stringify(draftPayload(editor.draft)) !== editor.baseline);
  useEffect(() => {
    if (recovery || !editor) return;
    try {
      if (dirty)
        sessionStorage.setItem(
          recoveryKey,
          JSON.stringify({ format: 1, savedAt: Date.now(), editor }),
        );
      else sessionStorage.removeItem(recoveryKey);
      setRecoveryError(false);
    } catch {
      setRecoveryError(true);
    }
  }, [editor, dirty, recovery, recoveryKey]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const conflict = Boolean(
    editor &&
    query.data?.plan &&
    (editor.planId !== query.data.plan.id ||
      editor.revision !== query.data.plan.versions[0]?.optimisticVersion ||
      editor.version !== query.data.plan.versions[0]?.version ||
      editor.status !== query.data.plan.versions[0]?.status),
  );
  const refresh = async () => {
    const result = await query.refetch();
    if (result.isError) throw result.error;
    if (result.data) setEditor(hydrate(result.data));
    await queryClient.invalidateQueries({ queryKey: ['client-plan'] });
    await queryClient.invalidateQueries({ queryKey: ['portal-home'] });
    await queryClient.invalidateQueries({ queryKey: ['work-queue'] });
    await queryClient.invalidateQueries({ queryKey: ['shell-client-context', clientId] });
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!editor) throw new Error('The Plan is not loaded.');
      return apiRequest(
        `/api/v1/consultant/clients/${clientId}/plans${editor.planId ? `/${editor.planId}` : ''}`,
        {
          method: editor.planId ? 'PUT' : 'POST',
          body: JSON.stringify(
            editor.planId
              ? { expectedVersion: editor.revision, draft: draftPayload(editor.draft) }
              : draftPayload(editor.draft),
          ),
        },
      );
    },
    onSuccess: async () => {
      await refresh();
      setNotice('Draft saved. These changes stay private until approval.');
    },
  });
  const approve = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/consultant/clients/${clientId}/plans/${editor!.planId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: editor!.revision }),
      }),
    onSuccess: async () => {
      setPreviewOpen(false);
      await refresh();
      setNotice('Plan approved. The client can now see this version.');
    },
  });
  const sources = useQuery({
    queryKey: ['plan-sources', clientId, editor?.planId],
    queryFn: () =>
      apiRequest<SourcePreview>(
        `/api/v1/consultant/clients/${clientId}/plans/${editor!.planId}/sources`,
      ),
    enabled: sourceOpen && Boolean(editor?.planId),
    staleTime: 0,
  });
  const reconcile = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/consultant/clients/${clientId}/plans/${editor!.planId}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: sources.data!.expectedVersion,
          expectedSourceFingerprint: sources.data!.fingerprint,
          reason: reason.trim(),
        }),
      }),
    onSuccess: async () => {
      setSourceOpen(false);
      setReason('');
      await refresh();
      setNotice('Sources updated in the draft. Review and approve it before the client continues.');
    },
  });
  const busy = save.isPending || approve.isPending || reconcile.isPending;
  useNavigationProtection(dirty, busy);
  const edit = (change: (draft: PlanDraft) => PlanDraft) => {
    if (!busy) {
      setNotice('');
      setEditor((value) => (value ? { ...value, draft: change(value.draft) } : value));
    }
  };
  if (query.isLoading || (!editor && !query.isError))
    return <Typography role="status">Loading Plan workspace…</Typography>;
  if (query.isError && !editor)
    return <RecoveryState error={query.error} onRetry={() => void query.refetch()} />;
  if (!editor) return null;
  if (recovery)
    return (
      <Stack spacing={2}>
        <PageHeader
          title="Recover your unfinished Plan"
          description="Unfinished edits from this browser tab are available. They have not been saved to the shared Plan or published to the client."
        />
        <Alert severity="info">
          Restore your edits to review them against the current server version, or discard this
          tab's copy and open the saved Plan.
        </Alert>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            onClick={() => {
              setEditor(recovery);
              setRecovery(null);
            }}
          >
            Restore unfinished edits
          </Button>
          <Button
            onClick={() => {
              setEditor(hydrate(query.data!));
              setRecovery(null);
            }}
          >
            Discard tab copy
          </Button>
        </Stack>
      </Stack>
    );
  const draft = editor.draft;
  const selected = draft.items.find((item) => item.stableKey === selectedKey) ?? draft.items[0];
  const protectedStep = selected ? hasProgress(selected) : false;
  const issues = editorIssues(draft);
  const changeItem = (patch: Partial<PlanItem>) =>
    edit((value) => ({
      ...value,
      items: value.items.map((item) =>
        item.stableKey === selected?.stableKey ? { ...item, ...patch } : item,
      ),
    }));
  const addItem = () => {
    const key = `step-${crypto.randomUUID()}`;
    edit((value) => ({
      ...value,
      items: [
        ...value.items,
        {
          stableKey: key,
          type: 'GUIDANCE',
          completionMode: 'ACKNOWLEDGEMENT',
          owner: 'CLIENT',
          clientTitle: '',
          clientBody: null,
          consultantRationale: null,
          sortOrder: value.items.length,
          required: true,
          pathKeys: [],
        },
      ],
    }));
    setSelectedKey(key);
  };
  const move = (direction: number) => {
    if (selected) setSelectedKey(selected.stableKey);
    edit((value) => {
      const items = [...value.items],
        index = items.findIndex((item) => item.stableKey === selected?.stableKey);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= items.length) return value;
      [items[index], items[next]] = [items[next]!, items[index]!];
      return { ...value, items };
    });
  };
  const remove = () => {
    if (!selected || protectedStep) return;
    edit((value) => ({
      ...value,
      items: value.items.filter((item) => item.stableKey !== selected.stableKey),
      groups: value.groups
        .filter((group) => group.dependentKey !== selected.stableKey)
        .map((group) => ({
          ...group,
          prerequisites: group.prerequisites.filter((key) => key !== selected.stableKey),
        })),
    }));
  };
  const canApprove = !dirty && !conflict && editor.status === 'DRAFT' && !issues.length && !busy;
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Client preparation"
        title="Plan workspace"
        description="Shape the client's next steps, connect prerequisites, and review what you publish."
      />
      <PlanExecutionReview clientId={clientId} />
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          label={
            dirty
              ? 'Unsaved changes'
              : editor.status === 'DRAFT'
                ? 'Saved draft'
                : editor.status === 'NEW'
                  ? 'New Plan'
                  : 'Published version'
          }
          color={dirty ? 'warning' : 'default'}
          variant="outlined"
        />
        <Typography variant="body2" color="text.secondary">
          Version {editor.version}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          disabled={!editor.planId || dirty || conflict || busy}
          onClick={() => {
            reconcile.reset();
            setSourceOpen(true);
          }}
        >
          Compare sources
        </Button>
        <Button onClick={() => setPreviewOpen(true)} disabled={busy}>
          Client preview
        </Button>
      </Stack>
      {dirty && (
        <Alert severity={recoveryError ? 'warning' : 'info'} role="status">
          {recoveryError
            ? 'This browser could not keep a recovery copy. Keep this page open and use Save draft to protect your work.'
            : 'Unfinished edits are kept in this browser tab for up to 24 hours. Use Save draft to keep them on the server. Signing out clears the tab copy.'}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" role="status">
          {notice}
        </Alert>
      )}
      {conflict && (
        <Alert severity="warning">
          A newer version was saved. Your edits are still here. Review the saved version before
          replacing your local changes.
          <Button onClick={() => setDiscardOpen(true)}>Review saved version</Button>
        </Alert>
      )}
      {save.isError && (
        <Alert severity="error">{message(save.error)} Your local edits are still available.</Alert>
      )}
      {query.isError && editor && (
        <Alert severity="warning">
          The server could not be refreshed. Your current edits are still here.
        </Alert>
      )}
      <Box component="fieldset" disabled={busy} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <TextField
            label="Plan title"
            fullWidth
            value={draft.title}
            onChange={(event) => edit((value) => ({ ...value, title: event.target.value }))}
          />
          <TextField
            select
            label="Purpose"
            value={draft.purpose}
            sx={{ minWidth: { sm: 240 } }}
            onChange={(event) => edit((value) => ({ ...value, purpose: event.target.value }))}
          >
            {Object.entries(purposes).map(([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Box
          data-testid="plan-three-zone-workbench"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: '210px minmax(0, 1fr)',
              xl: '210px minmax(0, 1fr) 280px',
            },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <Box
            component="aside"
            aria-label="Plan structure"
            sx={{
              borderRight: { md: 1 },
              borderColor: 'divider',
              pr: { md: 2 },
              position: { md: 'sticky' },
              top: 16,
            }}
          >
            <Typography variant="overline" color="text.secondary">
              Steps · {draft.items.length}
            </Typography>
            <List sx={{ maxHeight: { xs: 220, md: 600 }, overflowY: 'auto' }}>
              {draft.items.map((item, index) => (
                <ListItemButton
                  key={item.stableKey}
                  selected={selected?.stableKey === item.stableKey}
                  onClick={() => setSelectedKey(item.stableKey)}
                  sx={{ px: 1.5, py: 1.5, borderRadius: '8px', mb: 0.5 }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      {index + 1} · {item.type.toLowerCase()}
                      {hasProgress(item) ? ' · Progress saved' : ''}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.clientTitle || 'Untitled step'}
                    </Typography>
                  </Stack>
                </ListItemButton>
              ))}
            </List>
            <Button startIcon={<AddRounded />} onClick={addItem}>
              Add step
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Display order helps the client read the Plan. Prerequisites determine when a step
              becomes available.
            </Typography>
          </Box>
          <Stack spacing={3} aria-label="Plan item authoring" sx={{ minWidth: 0 }}>
            {!selected ? (
              <Alert severity="info">Add the first step to begin your Plan.</Alert>
            ) : (
              <>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                  <Typography variant="h3" sx={{ flex: 1 }}>
                    Step {draft.items.indexOf(selected) + 1}
                  </Typography>
                  <IconButton
                    aria-label="Move step up"
                    disabled={draft.items.indexOf(selected) === 0}
                    onClick={() => move(-1)}
                  >
                    <ArrowUpwardRounded />
                  </IconButton>
                  <IconButton
                    aria-label="Move step down"
                    disabled={draft.items.indexOf(selected) === draft.items.length - 1}
                    onClick={() => move(1)}
                  >
                    <ArrowDownwardRounded />
                  </IconButton>
                  <Button color="error" disabled={protectedStep} onClick={remove}>
                    Remove step
                  </Button>
                </Stack>
                {protectedStep && (
                  <Alert severity="info">
                    This step has recorded progress. Its instructions and prerequisites are
                    preserved. Add a new step for different work.
                  </Alert>
                )}
                <TextField
                  select
                  label="Step type"
                  value={selected.type}
                  disabled={protectedStep}
                  onChange={(event) => {
                    const type = event.target.value as PlanItem['type'];
                    changeItem({
                      type,
                      completionMode:
                        type === 'MILESTONE' ? 'CONSULTANT_VERIFY' : 'ACKNOWLEDGEMENT',
                      owner: type === 'MILESTONE' ? 'CONSULTANT' : 'CLIENT',
                    });
                  }}
                >
                  {['ACTION', 'GUIDANCE', 'MILESTONE'].map((type) => (
                    <MenuItem key={type} value={type}>
                      {type[0] + type.slice(1).toLowerCase()}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Client title"
                  value={selected.clientTitle}
                  disabled={protectedStep}
                  onChange={(event) => changeItem({ clientTitle: event.target.value })}
                />
                <TextField
                  label="Client guidance"
                  multiline
                  minRows={3}
                  value={selected.clientBody ?? ''}
                  disabled={protectedStep}
                  onChange={(event) => changeItem({ clientBody: event.target.value || null })}
                  helperText="Explain the purpose, the next action, and what the client should expect."
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    select
                    fullWidth
                    label="Who owns this step?"
                    value={selected.owner}
                    disabled
                    helperText="Determined by how this step is completed."
                  >
                    {[
                      ['CLIENT', 'Client'],
                      ['CONSULTANT', 'Consultant'],
                      ['SYSTEM', 'Automated check'],
                    ].map(([key, label]) => (
                      <MenuItem key={key} value={key}>
                        {label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    fullWidth
                    label="How is it completed?"
                    value={selected.completionMode}
                    disabled={protectedStep || selected.type === 'GUIDANCE'}
                    onChange={(event) =>
                      changeItem({
                        completionMode: event.target.value as PlanItem['completionMode'],
                        owner:
                          event.target.value === 'SYSTEM_VERIFY'
                            ? 'SYSTEM'
                            : event.target.value === 'CONSULTANT_VERIFY'
                              ? 'CONSULTANT'
                              : 'CLIENT',
                      })
                    }
                  >
                    {Object.entries(completionLabels)
                      .filter(
                        ([key]) =>
                          selected.type !== 'MILESTONE' ||
                          ['CONSULTANT_VERIFY', 'SYSTEM_VERIFY'].includes(key),
                      )
                      .map(([key, label]) => (
                        <MenuItem key={key} value={key}>
                          {label}
                        </MenuItem>
                      ))}
                  </TextField>
                </Stack>
                {['STRUCTURED_OUTCOME', 'CLIENT_REPORT_CONSULTANT_VERIFY'].includes(
                  selected.completionMode,
                ) && (
                  <ResponseSchemaEditor
                    schema={selected.outcomeSchema}
                    disabled={protectedStep}
                    onChange={(outcomeSchema) => changeItem({ outcomeSchema })}
                  />
                )}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selected.required}
                      disabled={protectedStep}
                      onChange={(_, checked) => changeItem({ required: checked })}
                    />
                  }
                  label="Required before this Plan is complete"
                />
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                  <Typography variant="h3">Available after</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
                    Every group below must be satisfied. Within a group, require all selected steps
                    or any one of them.
                  </Typography>
                  {!draft.groups.some((group) => group.dependentKey === selected.stableKey) && (
                    <Typography variant="body2" sx={{ my: 2 }}>
                      No prerequisites. This step can open when the Plan is approved.
                    </Typography>
                  )}
                  {draft.groups
                    .filter((group) => group.dependentKey === selected.stableKey)
                    .map((group, index) => (
                      <Box
                        key={group.key}
                        sx={{ borderLeft: '2px solid', borderColor: 'primary.main', pl: 2, my: 2 }}
                      >
                        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                          <Typography variant="body2">Group {index + 1}</Typography>
                          <TextField
                            select
                            size="small"
                            label="Requirement"
                            value={group.mode}
                            disabled={protectedStep}
                            onChange={(event) =>
                              edit((value) => ({
                                ...value,
                                groups: value.groups.map((entry) =>
                                  entry === group
                                    ? { ...entry, mode: event.target.value as 'ALL' | 'ANY' }
                                    : entry,
                                ),
                              }))
                            }
                          >
                            <MenuItem value="ALL">All selected steps</MenuItem>
                            <MenuItem value="ANY">Any selected step</MenuItem>
                          </TextField>
                          <Button
                            disabled={protectedStep}
                            onClick={() =>
                              edit((value) => ({
                                ...value,
                                groups: value.groups.filter((entry) => entry !== group),
                              }))
                            }
                          >
                            Remove group
                          </Button>
                        </Stack>
                        <Stack>
                          {draft.items
                            .filter((item) => item.stableKey !== selected.stableKey)
                            .map((item) => (
                              <FormControlLabel
                                key={item.stableKey}
                                control={
                                  <Checkbox
                                    disabled={
                                      protectedStep ||
                                      draft.groups.some(
                                        (other) =>
                                          other !== group &&
                                          other.dependentKey === selected.stableKey &&
                                          other.prerequisites.includes(item.stableKey),
                                      )
                                    }
                                    checked={group.prerequisites.includes(item.stableKey)}
                                    onChange={(_, checked) =>
                                      edit((value) => ({
                                        ...value,
                                        groups: value.groups.map((entry) =>
                                          entry === group
                                            ? {
                                                ...entry,
                                                prerequisites: checked
                                                  ? [...entry.prerequisites, item.stableKey]
                                                  : entry.prerequisites.filter(
                                                      (key) => key !== item.stableKey,
                                                    ),
                                              }
                                            : entry,
                                        ),
                                      }))
                                    }
                                  />
                                }
                                label={item.clientTitle || 'Untitled step'}
                              />
                            ))}
                        </Stack>
                      </Box>
                    ))}
                  <Button
                    disabled={protectedStep || draft.items.length < 2}
                    onClick={() =>
                      edit((value) => ({
                        ...value,
                        groups: [
                          ...value.groups,
                          {
                            dependentKey: selected.stableKey,
                            key: `group-${crypto.randomUUID()}`,
                            mode: 'ALL',
                            prerequisites: [],
                          },
                        ],
                      }))
                    }
                  >
                    Add prerequisite group
                  </Button>
                </Box>
                {draft.paths.length > 0 && (
                  <Box>
                    <Typography variant="h3">Paths containing this step</Typography>
                    {draft.paths.map((path) => (
                      <FormControlLabel
                        key={path.key}
                        control={
                          <Checkbox
                            disabled={protectedStep}
                            checked={selected.pathKeys.includes(path.key)}
                            onChange={(_, checked) =>
                              changeItem({
                                pathKeys: checked
                                  ? [...selected.pathKeys, path.key]
                                  : selected.pathKeys.filter((key) => key !== path.key),
                              })
                            }
                          />
                        }
                        label={path.clientLabel}
                      />
                    ))}
                  </Box>
                )}
                <TextField
                  label="Consultant-only rationale"
                  multiline
                  minRows={2}
                  value={selected.consultantRationale ?? ''}
                  onChange={(event) =>
                    changeItem({ consultantRationale: event.target.value || null })
                  }
                  helperText="This note is not included in the client preview."
                />
              </>
            )}
          </Stack>
          <Box
            component="aside"
            aria-label="Plan context and client preview"
            sx={{
              p: 2.5,
              borderRadius: '12px',
              bgcolor: 'rgba(118,181,164,.08)',
              border: 1,
              borderColor: 'divider',
              gridColumn: { md: '1 / -1', xl: 'auto' },
              position: { xl: 'sticky' },
              top: 16,
            }}
          >
            <Typography variant="overline" color="text.secondary">
              Client preview
            </Typography>
            <Typography variant="h3" sx={{ mt: 1, mb: 2 }}>
              {draft.title}
            </Typography>
            {selected && (
              <>
                <Typography sx={{ fontWeight: 600 }}>
                  {selected.clientTitle || 'Untitled step'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                  {selected.clientBody || 'Add guidance to explain this step.'}
                </Typography>
                <Typography variant="caption" sx={{ mt: 2, display: 'block' }}>
                  Next owner:{' '}
                  {selected.owner === 'CLIENT'
                    ? 'You'
                    : selected.owner === 'CONSULTANT'
                      ? 'Your consultant'
                      : 'Automated check'}
                </Typography>
              </>
            )}
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              {draft.items.filter(hasProgress).length} steps have recorded progress. Saved drafts
              stay private until approval.
            </Typography>
          </Box>
        </Box>
      </Box>
      {issues.length > 0 && (
        <Alert severity="warning">
          {issues.map((issue) => (
            <Typography key={issue} variant="body2">
              {issue}
            </Typography>
          ))}
        </Alert>
      )}
      <Stack
        direction="row"
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 3,
          py: 2,
          px: 2,
          gap: 1.5,
          flexWrap: 'wrap',
          alignItems: 'center',
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2" sx={{ flex: 1 }}>
          {dirty
            ? 'Save your changes before comparing sources or approving.'
            : 'Only the approved version is visible to the client.'}
        </Typography>
        <Button
          variant="outlined"
          disabled={busy || conflict || Boolean(issues.length)}
          onClick={() => save.mutate()}
        >
          Save draft
        </Button>
        <Button
          variant="contained"
          disabled={!canApprove}
          onClick={() => {
            approve.reset();
            setPreviewOpen(true);
          }}
        >
          Review & approve
        </Button>
      </Stack>
      <Drawer
        anchor="right"
        open={sourceOpen}
        onClose={() => !busy && setSourceOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 620 }, p: 3 } } }}
      >
        <Stack spacing={3}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h2">Compare sources</Typography>
            <IconButton
              aria-label="Close source comparison"
              onClick={() => setSourceOpen(false)}
              disabled={busy}
            >
              <CloseRounded />
            </IconButton>
          </Stack>
          <Typography color="text.secondary">
            Compare the Plan's saved references with the client's latest published review and
            primary goal.
          </Typography>
          {sources.isFetching && <Typography role="status">Checking current sources…</Typography>}
          {sources.isError && (
            <RecoveryState error={sources.error} onRetry={() => void sources.refetch()} />
          )}
          {sources.data && !sources.isFetching && !sources.isError && (
            <>
              {sources.data.changes.map((change) => (
                <Box key={change.field} sx={{ py: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                    <Typography sx={{ fontWeight: 650 }}>{change.label}</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={change.changed ? 'Changed' : 'Unchanged'}
                      color={change.changed ? 'warning' : 'default'}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Plan: {change.before}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Latest: {change.after}
                  </Typography>
                </Box>
              ))}
              <Typography variant="h3">Progress retained</Typography>
              {sources.data.keptSteps.length ? (
                sources.data.keptSteps.map((step, i) => (
                  <Typography variant="body2" key={i}>
                    {step.title} · {step.status.replaceAll('_', ' ').toLowerCase()}
                  </Typography>
                ))
              ) : (
                <Typography variant="body2">No recorded step progress to carry forward.</Typography>
              )}
              {sources.data.changed ? (
                <>
                  <Alert severity="info">
                    Your saved instructions stay in the draft.
                    {sources.data.hasPublishedPlan
                      ? ' The published Plan will pause for source review until you approve the updated draft.'
                      : ' Review the draft after updating its sources.'}
                  </Alert>
                  <TextField
                    label="Reason for source review"
                    multiline
                    minRows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <Button
                    variant="contained"
                    disabled={!reason.trim() || busy || dirty || conflict}
                    onClick={() => reconcile.mutate()}
                  >
                    Update draft sources
                  </Button>
                </>
              ) : (
                <Alert severity="success">
                  The Plan already uses these source references. No replacement is needed.
                </Alert>
              )}
            </>
          )}
          {reconcile.isError && (
            <Alert severity="error">
              {message(reconcile.error)}
              <Button onClick={() => void sources.refetch()}>Refresh comparison</Button>
            </Alert>
          )}
        </Stack>
      </Drawer>
      <Dialog
        open={previewOpen}
        onClose={() => !busy && setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {dirty ? 'Preview of your unsaved edits' : 'Review the client Plan'}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="h2" sx={{ mb: 3 }}>
            {draft.title}
          </Typography>
          {previewOpen && <PlanLifecyclePreview draft={draft} clientId={clientId} />}
          {approve.isError && (
            <Alert severity="error" sx={{ mt: 3 }}>
              {message(approve.error)}
              {'status' in approve.error && approve.error.status === 403 && (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Approval requires current identity verification and access to this client. If
                    your verification expired, verify again and return to this saved draft. If
                    access is still denied, ask your administrator to check your assignment.
                  </Typography>
                  <Button
                    component={Link}
                    to={`/mfa?mode=challenge&returnTo=${encodeURIComponent(`/crm/clients/${clientId}/plan`)}`}
                  >
                    Verify identity
                  </Button>
                </Stack>
              )}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)} disabled={busy}>
            Back to editing
          </Button>
          <Button variant="contained" disabled={!canApprove} onClick={() => approve.mutate()}>
            Approve this version
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        fullWidth
        maxWidth="lg"
        aria-labelledby="plan-conflict-title"
      >
        <DialogTitle id="plan-conflict-title">Compare your edits with the saved Plan</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Your editing revision: {editor.revision}. Latest loaded revision:{' '}
            {query.data?.plan?.versions[0]?.optimisticVersion ?? 'Unavailable'}. Comparing does not
            change either version.
          </Typography>
          {query.data && (
            <PlanDraftComparison local={editor.draft} saved={draftFromBuilder(query.data)} />
          )}
          {query.data && (
            <PlanConflictResolution
              key={JSON.stringify(query.data)}
              local={editor.draft}
              saved={draftFromBuilder(query.data)}
              onResolve={(draft) => {
                setEditor({ ...hydrate(query.data!), draft });
                setDiscardOpen(false);
                save.reset();
                setNotice(
                  'Selected wording restored into a working copy of the saved Plan. Review all changes, then Save draft.',
                );
              }}
            />
          )}
          <Typography sx={{ mt: 2 }}>
            Loading the saved Plan without a selection discards all unfinished edits.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardOpen(false)}>Keep my edits</Button>
          <Button
            color="warning"
            onClick={() => {
              if (query.data) setEditor(hydrate(query.data));
              setDiscardOpen(false);
              save.reset();
            }}
          >
            Discard edits and load saved Plan
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
