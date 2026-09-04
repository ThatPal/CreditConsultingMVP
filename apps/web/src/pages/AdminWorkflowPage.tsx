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
type Rule = {
  id: string;
  key: string;
  version: number;
  trigger: string;
  conditionType: string;
  actionType: string;
  enabled: boolean;
  reason: string;
  createdAt: string;
};
export function AdminWorkflowPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['workflow-rules'],
    queryFn: () => apiRequest<{ rules: Rule[] }>('/api/v1/admin/workflow-rules'),
  });
  const [key, setKey] = useState(''),
    [trigger, setTrigger] = useState('SUPPORT_CASE_CREATED'),
    [action, setAction] = useState('CREATE_NOTIFICATION');
  const create = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/admin/workflow-rules/${key}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          trigger,
          condition: { type: 'ALWAYS' },
          action:
            action === 'CREATE_NOTIFICATION'
              ? { type: action, category: 'operations' }
              : { type: action, priority: 'NORMAL' },
          enabled: false,
          reason: 'Governed workflow rule draft for operational review',
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-rules'] }),
  });
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Workflow rules"
        description="Typed, versioned operational automation. Free-form scripts and authority-changing actions are not supported."
      />
      <Alert severity="info">
        New rules are disabled drafts and can only use the bounded trigger, condition, and action
        catalog.
      </Alert>
      <SectionCard>
        <Typography variant="h6">Create rule version</Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField label="Rule key" value={key} onChange={(e) => setKey(e.target.value)} />
          <TextField
            select
            label="Trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
          >
            {[
              'SUPPORT_CASE_CREATED',
              'DOCUMENT_UPLOADED',
              'PAYMENT_FAILED',
              'AI_JOB_FAILED',
              'ROUND_COMPLETED',
            ].map((v) => (
              <MenuItem value={v} key={v}>
                {v}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <MenuItem value="CREATE_NOTIFICATION">Create notification</MenuItem>
            <MenuItem value="CREATE_ATTENTION_ITEM">Create attention item</MenuItem>
          </TextField>
          <Button disabled={!key || create.isPending} onClick={() => create.mutate()}>
            Create disabled version
          </Button>
        </Stack>
      </SectionCard>
      <SectionCard>
        <Stack divider={<Divider flexItem />}>
          {q.data?.rules.map((rule) => (
            <Stack key={rule.id} sx={{ py: 2 }}>
              <Stack direction="row" spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>
                  {rule.key} v{rule.version}
                </Typography>
                <Chip size="small" label={rule.enabled ? 'Enabled' : 'Disabled'} />
              </Stack>
              <Typography variant="body2">
                {rule.trigger} → {rule.actionType} when {rule.conditionType}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {rule.reason}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
