import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { Link, useParams } from 'react-router-dom';
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
              <Button component={Link} to={`/crm/clients/${clientId}/rounds/${item.roundId}/live`}>
                Open live session
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
