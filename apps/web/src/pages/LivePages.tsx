import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  CircularProgress,
  Grid,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';

type Slot = { startsAt: string; endsAt: string; timezone: string; durationMinutes: number };
type Appointment = {
  id: string;
  clientId?: string;
  roundId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: string;
  externalSyncStatus: string;
};

export function ScheduleRoundPage() {
  const { roundId = '' } = useParams();
  const [data, setData] = useState<{
    eligible: boolean;
    blockers: string[];
    providerDegraded: boolean;
    slots: Slot[];
  }>();
  const [appointment, setAppointment] = useState<Appointment | null>();
  const [error, setError] = useState('');
  const load = async () => {
    try {
      const [slots, current] = await Promise.all([
        apiRequest<typeof data>(`/api/v1/client/rounds/${roundId}/appointment-slots`),
        apiRequest<{ appointment: Appointment | null }>(
          `/api/v1/client/rounds/${roundId}/appointment`,
        ),
      ]);
      setData(slots);
      setAppointment(current.appointment);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Scheduling could not be loaded.');
    }
  };
  useEffect(() => {
    void load();
  }, [roundId]);
  const book = async (slot: Slot) => {
    try {
      await apiRequest(`/api/v1/client/rounds/${roundId}/appointments`, {
        method: 'POST',
        body: JSON.stringify({
          startsAt: slot.startsAt,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That slot is no longer available.');
    }
  };
  const cancel = async () => {
    if (!appointment) return;
    await apiRequest(`/api/v1/client/appointments/${appointment.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Client cancelled', idempotencyKey: crypto.randomUUID() }),
    });
    await load();
  };
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="PORTAL-28"
        title="Schedule your guided application session"
        description="Choose an available time. Your internal appointment remains confirmed even if optional calendar sync is delayed."
      />
      {error && <Alert severity="error">{error}</Alert>}
      {!data ? (
        <CircularProgress aria-label="Loading appointment availability" />
      ) : appointment ? (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Upcoming appointment</Typography>
              <Typography>
                {new Date(appointment.startsAt).toLocaleString()} · {appointment.timezone}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip label={appointment.status} color="success" />
                <Chip label={`Calendar: ${appointment.externalSyncStatus}`} variant="outlined" />
              </Stack>
              <Button variant="outlined" color="error" onClick={() => void cancel()}>
                Cancel appointment
              </Button>
              <Button component={Link} to={`/app/rounds/${roundId}/live`} variant="contained">
                Join session
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent>
              <Typography variant="h6">Eligibility</Typography>
              {data.eligible ? (
                <Alert severity="success">
                  Your approved Strategy and Round are ready for scheduling.
                </Alert>
              ) : (
                <Alert severity="warning">{data.blockers.join(', ')}</Alert>
              )}
            </CardContent>
          </Card>
          {data.providerDegraded && (
            <Alert severity="info">
              External calendar sync is not configured. Internal appointments remain authoritative.
            </Alert>
          )}
          <Grid container spacing={2}>
            {data.slots.map((slot) => (
              <Grid key={slot.startsAt} size={{ xs: 12, sm: 6, md: 4 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  sx={{ minHeight: 64 }}
                  onClick={() => void book(slot)}
                >
                  {new Date(slot.startsAt).toLocaleString()}
                  <br />
                  {slot.durationMinutes} minutes
                </Button>
              </Grid>
            ))}
          </Grid>
          {data.eligible && data.slots.length === 0 && (
            <Alert severity="info">No appointment slots are currently available.</Alert>
          )}
        </>
      )}
    </Stack>
  );
}

export function ConsultantCalendarPage() {
  const [items, setItems] = useState<Appointment[]>();
  useEffect(() => {
    void apiRequest<{ appointments: Appointment[] }>('/api/v1/consultant/calendar').then((value) =>
      setItems(value.appointments),
    );
  }, []);
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="CRM-26"
        title="Calendar"
        description="Internal appointments are canonical. External busy time never exposes private event details."
      />
      {!items ? (
        <CircularProgress />
      ) : items.length === 0 ? (
        <Alert severity="info">No appointments are scheduled.</Alert>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <CardContent>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                sx={{ justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography variant="h6">Guided application session</Typography>
                  <Typography>
                    {new Date(item.startsAt).toLocaleString()} · {item.timezone}
                  </Typography>
                </Box>
                <Button
                  component={Link}
                  to={`/crm/clients/${item.clientId}/appointments/${item.id}`}
                >
                  Open appointment
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  );
}

export function AppointmentDetailPage() {
  const { clientId = '', appointmentId = '' } = useParams();
  const [item, setItem] = useState<Appointment>();
  const navigate = useNavigate();
  useEffect(() => {
    void apiRequest<{ appointment: Appointment }>(
      `/api/v1/consultant/clients/${clientId}/appointments/${appointmentId}`,
    ).then((value) => setItem(value.appointment));
  }, [clientId, appointmentId]);
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="CRM-27"
        title="Appointment detail"
        description="Governed scheduling and calendar-sync state."
      />
      {!item ? (
        <CircularProgress />
      ) : (
        <Card>
          <CardContent>
            <Stack spacing={1}>
              <Typography>Starts: {new Date(item.startsAt).toLocaleString()}</Typography>
              <Typography>Ends: {new Date(item.endsAt).toLocaleString()}</Typography>
              <Typography>Client timezone: {item.timezone}</Typography>
              <Typography>Status: {item.status}</Typography>
              <Typography>External sync: {item.externalSyncStatus}</Typography>
              <Button
                variant="contained"
                onClick={() =>
                  void apiRequest<{ result: { id: string } }>(
                    `/api/v1/consultant/appointments/${appointmentId}/session`,
                    {
                      method: 'POST',
                      body: JSON.stringify({ idempotencyKey: `start-${appointmentId}` }),
                    },
                  ).then((value) => navigate(`/crm/live-sessions/${value.result.id}`))
                }
              >
                Start or open live session
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

type SessionSnapshot = {
  session: {
    id: string;
    roundId: string;
    status: string;
    pauseReason?: string;
    strategyVersionId: string;
    version: number;
  };
  presence: { clientPresent: boolean; consultantPresent: boolean; supervisionSafe: boolean };
  messages: Array<{ id: string; authorRole: string; body: string; createdAt: string }>;
  execution: { decisionType: string } | null;
};
type ReleasedApplication = {
  id: string;
  status: string;
  product: { displayName: string; slug: string } | null;
  offerFacts: unknown;
  whyThisCard: string | null;
  allowedActions: string[];
};

export function LiveSessionPage({ consultant = false }: { consultant?: boolean }) {
  const { roundId = '', sessionId: routeSessionId = '' } = useParams();
  const [sessionId, setSessionId] = useState(routeSessionId);
  const [snapshot, setSnapshot] = useState<SessionSnapshot>();
  const [application, setApplication] = useState<ReleasedApplication | null>(null);
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState('');
  const connectionId = useState(() => crypto.randomUUID())[0];
  const load = async (id = sessionId) => {
    if (!id) return;
    try {
      setSnapshot(await apiRequest<SessionSnapshot>(`/api/v1/sessions/${id}`));
      if (!consultant)
        setApplication(
          (
            await apiRequest<{ application: ReleasedApplication | null }>(
              `/api/v1/client/sessions/${id}/current-application`,
            )
          ).application,
        );
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Live session unavailable.');
    }
  };
  useEffect(() => {
    if (routeSessionId) {
      setSessionId(routeSessionId);
      void load(routeSessionId);
      return;
    }
    void apiRequest<{ sessionId: string | null }>(`/api/v1/client/rounds/${roundId}/session`).then(
      (value) => {
        if (value.sessionId) {
          setSessionId(value.sessionId);
          void load(value.sessionId);
        }
      },
    );
  }, [roundId, routeSessionId]);
  useEffect(() => {
    if (!sessionId) return;
    const beat = () =>
      void apiRequest(`/api/v1/sessions/${sessionId}/presence`, {
        method: 'POST',
        body: JSON.stringify({ connectionId }),
      }).then(() => load(sessionId));
    beat();
    const timer = window.setInterval(beat, 30_000);
    return () => window.clearInterval(timer);
  }, [sessionId]);
  const send = async () => {
    if (!message.trim()) return;
    await apiRequest(`/api/v1/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: message, idempotencyKey: crypto.randomUUID() }),
    });
    setMessage('');
    await load();
  };
  const confirm = async (noChanges: boolean) => {
    if (!snapshot) return;
    try {
      await apiRequest(`/api/v1/sessions/${sessionId}/prelive-confirmations`, {
        method: 'POST',
        body: JSON.stringify({
          noChanges,
          categories: noChanges ? [] : categories,
          expectedSessionVersion: snapshot.session.version,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Confirmation could not be saved.');
    }
  };
  const applicationAction = async (action: 'OPEN' | 'SKIP' | 'HELP') => {
    if (!application) return;
    await apiRequest(`/api/v1/client/applications/${application.id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, idempotencyKey: crypto.randomUUID() }),
    });
    await load();
  };
  const recordResult = async (outcome: string) => {
    if (!application) return;
    await apiRequest(`/api/v1/client/applications/${application.id}/result`, {
      method: 'POST',
      body: JSON.stringify({
        outcome,
        approvedLimitKnown: false,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    setApplication(null);
    await load();
  };
  const consultantCommand = async (action: 'EVALUATE' | 'PAUSE' | 'RESUME' | 'END') => {
    if (!snapshot) return;
    const path = action === 'EVALUATE' ? 'evaluate' : 'transition';
    const body =
      action === 'EVALUATE'
        ? { idempotencyKey: crypto.randomUUID() }
        : {
            action,
            expectedVersion: snapshot.session.version,
            idempotencyKey: crypto.randomUUID(),
          };
    await apiRequest(`/api/v1/consultant/sessions/${sessionId}/${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    await load();
  };
  if (!sessionId)
    return (
      <Stack spacing={3}>
        <PageHeader
          eyebrow="PORTAL-29"
          title="Live application session"
          description="Your consultant will start the session at the scheduled time."
        />
        <Alert severity="info">Waiting for your consultant to start the session.</Alert>
      </Stack>
    );
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={consultant ? 'CRM-19' : 'PORTAL-29'}
        title="Live application session"
        description="Committed session state remains authoritative if your connection is interrupted."
      />
      {error && <Alert severity="error">{error}</Alert>}
      {!snapshot ? (
        <CircularProgress />
      ) : (
        <>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={snapshot.session.status} />
            <Chip
              label={snapshot.presence.clientPresent ? 'Client present' : 'Client away'}
              variant="outlined"
            />
            <Chip
              label={snapshot.presence.consultantPresent ? 'Consultant present' : 'Consultant away'}
              variant="outlined"
              color={snapshot.presence.supervisionSafe ? 'success' : 'warning'}
            />
          </Stack>
          {snapshot.session.status === 'PAUSED' && (
            <Alert severity="warning">
              Applications are safely paused. {snapshot.session.pauseReason}
            </Alert>
          )}
          {snapshot.execution && (
            <Alert
              severity={
                snapshot.execution.decisionType === 'INTERVENTION_REQUIRED' ? 'warning' : 'info'
              }
              aria-live="polite"
            >
              Next session state:{' '}
              {snapshot.execution.decisionType.replaceAll('_', ' ').toLowerCase()}
            </Alert>
          )}
          {consultant && (
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Governed session controls</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <Button variant="contained" onClick={() => void consultantCommand('EVALUATE')}>
                      Evaluate latest result
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() =>
                        void consultantCommand(
                          snapshot.session.status === 'PAUSED' ? 'RESUME' : 'PAUSE',
                        )
                      }
                    >
                      {snapshot.session.status === 'PAUSED'
                        ? 'Resume after revalidation'
                        : 'Pause safely'}
                    </Button>
                    <Button
                      color="error"
                      variant="outlined"
                      onClick={() => void consultantCommand('END')}
                    >
                      End live session
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}
          {!consultant && application && (
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="overline">Current approved card</Typography>
                  <Typography variant="h5">
                    {application.product?.displayName ?? 'Approved card'}
                  </Typography>
                  <Typography>{application.whyThisCard}</Typography>
                  <Typography variant="body2">
                    Frozen offer facts: {JSON.stringify(application.offerFacts)}
                  </Typography>
                  {application.status === 'RELEASED' ? (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button variant="contained" onClick={() => void applicationAction('OPEN')}>
                        Apply on issuer site
                      </Button>
                      <Button variant="outlined" onClick={() => void applicationAction('SKIP')}>
                        Skip this card
                      </Button>
                      <Button variant="text" onClick={() => void applicationAction('HELP')}>
                        Need help
                      </Button>
                    </Stack>
                  ) : (
                    <Stack spacing={1}>
                      <Typography variant="h6">What happened?</Typography>
                      {(
                        [
                          ['APPROVED', 'Approved'],
                          ['DECLINED', 'Declined'],
                          ['PENDING', 'Pending / under review'],
                          ['APPLICATION_NOT_COMPLETED', 'Application not completed'],
                          ['TECHNICAL_ISSUE', 'Technical issue'],
                          ['OTHER', 'Other / needs consultant review'],
                        ] as Array<[string, string]>
                      ).map(([value, label]) => (
                        <Button
                          key={value}
                          variant="outlined"
                          onClick={() => void recordResult(value)}
                        >
                          {label}
                        </Button>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}
          {!consultant && snapshot.session.status !== 'PAUSED' && (
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">One final check before applications</Typography>
                  <Typography>
                    Has anything material changed since your Strategy was approved?
                  </Typography>
                  <Button variant="contained" onClick={() => void confirm(true)}>
                    No material changes
                  </Button>
                  <Typography variant="subtitle2">I have new or changed information</Typography>
                  {(
                    [
                      ['NEW_APPLICATION', 'New application or inquiry'],
                      ['ACCOUNT_OPENED_OR_CLOSED', 'Account opened or closed'],
                      ['BALANCE_OR_LIMIT', 'Balance or limit changed'],
                      ['MAJOR_APPLICATION_PLAN', 'Major application plan changed'],
                      ['OTHER', 'Other material change'],
                    ] as Array<[string, string]>
                  ).map(([value, label]) => (
                    <FormControlLabel
                      key={value}
                      control={
                        <Checkbox
                          checked={categories.includes(value)}
                          onChange={(event) =>
                            setCategories((current) =>
                              event.target.checked
                                ? [...current, value]
                                : current.filter((item) => item !== value),
                            )
                          }
                        />
                      }
                      label={label}
                    />
                  ))}
                  <Button
                    variant="outlined"
                    disabled={!categories.length}
                    onClick={() => void confirm(false)}
                  >
                    Send changes for consultant review
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Session messages</Typography>
                {snapshot.messages.length === 0 ? (
                  <Typography color="text.secondary">No messages yet.</Typography>
                ) : (
                  snapshot.messages.map((item) => (
                    <Box key={item.id}>
                      <Typography variant="caption">
                        {item.authorRole} · {new Date(item.createdAt).toLocaleTimeString()}
                      </Typography>
                      <Typography>{item.body}</Typography>
                    </Box>
                  ))
                )}
                <Stack direction="row" spacing={1}>
                  <input
                    aria-label="Session message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    style={{ flex: 1, minHeight: 44 }}
                  />
                  <Button variant="contained" onClick={() => void send()}>
                    Send
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          <Alert
            severity={snapshot.presence.supervisionSafe ? 'success' : 'info'}
            aria-live="polite"
          >
            {snapshot.presence.supervisionSafe
              ? 'Supervised session is connected.'
              : 'Waiting for both participants. New application releases remain blocked.'}
          </Alert>
        </>
      )}
    </Stack>
  );
}

export function LiveSessionsPage() {
  const [items, setItems] =
    useState<
      Array<{ id: string; clientId: string; roundId: string; status: string; updatedAt: string }>
    >();
  useEffect(() => {
    void apiRequest<{
      sessions: Array<{
        id: string;
        clientId: string;
        roundId: string;
        status: string;
        updatedAt: string;
      }>;
    }>('/api/v1/consultant/live-sessions').then((value) => setItems(value.sessions));
  }, []);
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="CRM-18"
        title="Live Sessions"
        description="Supervise active, waiting, paused, and recently completed sessions."
      />
      {!items ? (
        <CircularProgress />
      ) : items.length === 0 ? (
        <Alert severity="info">No live sessions yet.</Alert>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6">Round session</Typography>
                  <Typography>
                    {item.status} · updated {new Date(item.updatedAt).toLocaleString()}
                  </Typography>
                </Box>
                <Button component={Link} to={`/crm/live-sessions/${item.id}`}>
                  Open console
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  );
}
