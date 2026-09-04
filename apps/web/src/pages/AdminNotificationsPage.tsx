import {
  Alert,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../auth/api';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
type Template = {
  id: string;
  key: string;
  version: number;
  channel: string;
  subject: string | null;
  body: string;
  enabled: boolean;
  createdAt: string;
};
type Delivery = {
  id: string;
  channel: string;
  provider: string;
  status: string;
  attemptCount: number;
  failureCategory: string | null;
  createdAt: string;
  notification: { category: string; userId: string };
};
export function AdminNotificationsPage() {
  const qc = useQueryClient();
  const templates = useQuery({
    queryKey: ['admin-templates'],
    queryFn: () => apiRequest<{ templates: Template[] }>('/api/v1/admin/notification-templates'),
  });
  const deliveries = useQuery({
    queryKey: ['admin-deliveries'],
    queryFn: () =>
      apiRequest<{ deliveries: Delivery[] }>('/api/v1/admin/notification-deliveries?limit=50'),
  });
  const [key, setKey] = useState(''),
    [channel, setChannel] = useState('EMAIL'),
    [subject, setSubject] = useState(''),
    [body, setBody] = useState('');
  const create = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/admin/notification-templates/${key}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          channel,
          subject: channel === 'EMAIL' ? subject : undefined,
          body,
          enabled: false,
          reason: 'Governed notification template version',
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-templates'] }),
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Notification operations"
        description="Versioned templates and provider-safe delivery diagnostics."
      />
      <Alert severity="info">
        Templates cannot reference password, token, secret, or card data. New versions are disabled.
      </Alert>
      <SectionCard>
        <Typography variant="h6">Create template version</Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField label="Template key" value={key} onChange={(e) => setKey(e.target.value)} />
          <TextField
            select
            label="Channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <MenuItem value="EMAIL">Email</MenuItem>
            <MenuItem value="IN_APP">In-app</MenuItem>
          </TextField>
          {channel === 'EMAIL' && (
            <TextField
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          )}
          <TextField
            multiline
            minRows={3}
            label="Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button disabled={!key || !body || create.isPending} onClick={() => create.mutate()}>
            Create disabled version
          </Button>
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h6">Template history</Typography>
        <Stack divider={<Divider flexItem />}>
          {templates.data?.templates.map((t) => (
            <Stack key={t.id} sx={{ py: 1 }} direction="row" spacing={1}>
              <Typography>
                {t.key} v{t.version}
              </Typography>
              <Chip size="small" label={t.channel} />
              <Chip size="small" label={t.enabled ? 'Enabled' : 'Disabled'} />
            </Stack>
          ))}
        </Stack>
      </SectionCard>
      <SectionCard>
        <Typography variant="h6">Recent deliveries</Typography>
        <Stack divider={<Divider flexItem />}>
          {deliveries.data?.deliveries.map((d) => (
            <Stack key={d.id} sx={{ py: 1 }}>
              <Typography>
                {d.notification.category} · {d.channel} via {d.provider}
              </Typography>
              <Typography variant="caption">
                {d.status} · {d.attemptCount} attempts{' '}
                {d.failureCategory ? `· ${d.failureCategory}` : ''}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
