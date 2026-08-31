import AddRounded from '@mui/icons-material/AddRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import ForumRounded from '@mui/icons-material/ForumRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import SupportAgentRounded from '@mui/icons-material/SupportAgentRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
  MenuItem,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type SupportCategory =
  | 'ACCOUNT'
  | 'BILLING'
  | 'CREDIT_REVIEW'
  | 'DOCUMENTS'
  | 'APPLICATION_ROUND'
  | 'MAJOR_READINESS'
  | 'TECHNICAL'
  | 'OTHER';
type SupportStatus = 'OPEN' | 'WAITING_ON_SUPPORT' | 'WAITING_ON_CLIENT' | 'RESOLVED' | 'CLOSED';
type SupportCase = {
  id: string;
  category: SupportCategory;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  status: SupportStatus;
  subject: string;
  lastMessageAt: string;
  createdAt: string;
  unread?: boolean;
  context?: { type: string; resourceId: string | null; summary: string };
  attachments?: Array<{
    id: string;
    document: { id: string; displayFileName: string; mimeType: string; sizeBytes: number };
  }>;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; role: 'CLIENT' | 'CONSULTANT' | 'ADMIN' };
  }>;
};

const categories: Array<[SupportCategory, string]> = [
  ['ACCOUNT', 'Account'],
  ['BILLING', 'Billing'],
  ['CREDIT_REVIEW', 'Credit Review'],
  ['DOCUMENTS', 'Documents'],
  ['APPLICATION_ROUND', 'Application Round'],
  ['MAJOR_READINESS', 'Credit Readiness'],
  ['TECHNICAL', 'Technical'],
  ['OTHER', 'Other'],
];
const categoryLabels = Object.fromEntries(categories) as Record<SupportCategory, string>;
const statusLabels: Record<SupportStatus, string> = {
  OPEN: 'Open',
  WAITING_ON_SUPPORT: 'Waiting on support',
  WAITING_ON_CLIENT: 'Needs your reply',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};
const priorityLabels = { NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' } as const;
const priorityColors = {
  NORMAL: 'info.main',
  HIGH: 'warning.main',
  URGENT: 'error.main',
} as const;

export function SupportPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState<SupportCategory>('CREDIT_REVIEW');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [attachmentDocumentIds, setAttachmentDocumentIds] = useState<string[]>([]);
  const contextType = searchParams.get('contextType') ?? 'GENERAL';
  const contextResourceId = searchParams.get('contextId');
  const categoryQuery = useQuery({
    queryKey: ['support-categories'],
    queryFn: () =>
      apiRequest<{
        categories: Array<{ key: SupportCategory; name: string; allowedContextTypes: string[] }>;
      }>('/api/v1/client/support-categories'),
  });
  const documentQuery = useQuery({
    queryKey: ['documents'],
    queryFn: () =>
      apiRequest<{
        documents: Array<{ id: string; displayFileName: string; status: string }>;
      }>('/api/v1/documents'),
  });
  const query = useQuery({
    queryKey: ['support-cases'],
    queryFn: () => apiRequest<{ cases: SupportCase[] }>('/api/v1/client/support-cases'),
  });
  const cases = query.data?.cases ?? [];
  const selected = cases.find((supportCase) => supportCase.id === selectedId) ?? null;
  useEffect(() => {
    const linkedCaseId = searchParams.get('case');
    if (linkedCaseId && cases.some((item) => item.id === linkedCaseId)) setSelectedId(linkedCaseId);
  }, [cases, searchParams]);
  useEffect(() => {
    if (!isMobile && !selectedId && cases.length) setSelectedId(cases[0]!.id);
  }, [cases, isMobile, selectedId]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['support-cases'] });
  const createCase = useMutation({
    mutationFn: () =>
      apiRequest<{ case: SupportCase }>('/api/v1/client/support-cases', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          category,
          priority,
          subject,
          message,
          contextType,
          contextResourceId,
          attachmentDocumentIds,
        }),
      }),
    onSuccess: async ({ case: created }) => {
      await refresh();
      setSelectedId(created.id);
      setNewRequestOpen(false);
      setSubject('');
      setMessage('');
      setPriority('NORMAL');
      setAttachmentDocumentIds([]);
    },
  });
  const sendReply = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/client/support-cases/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: reply }),
      }),
    onSuccess: async () => {
      setReply('');
      await refresh();
    },
  });
  const updateStatus = useMutation({
    mutationFn: (status: 'OPEN' | 'RESOLVED') =>
      apiRequest(`/api/v1/client/support-cases/${selectedId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: refresh,
  });

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) return <Alert severity="error">Unable to load support requests.</Alert>;

  return (
    <Stack spacing={3}>
      <Box sx={{ display: { xs: selected ? 'none' : 'block', md: 'block' } }}>
        <PageHeader
          eyebrow="Help center"
          title="Support"
          description="Ask account and platform questions, then keep every reply in one place."
          actions={
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setNewRequestOpen(true)}
            >
              New request
            </Button>
          }
        />
      </Box>
      <Alert severity="info" sx={{ display: { xs: selected ? 'none' : 'flex', md: 'flex' } }}>
        Questions about a live application session remain in that session. Use Support for account,
        billing, documents, Reviews, and platform assistance.
      </Alert>

      {cases.length === 0 ? (
        <SectionCard>
          <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
            <SupportAgentRounded color="primary" sx={{ fontSize: 44 }} />
            <Box>
              <Typography variant="h3">How can we help?</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Create a request and its complete conversation will appear here.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setNewRequestOpen(true)}
            >
              Create your first request
            </Button>
          </Stack>
        </SectionCard>
      ) : (
        <Grid container spacing={2}>
          <Grid
            size={{ xs: 12, md: 5, lg: 4 }}
            sx={{ display: { xs: selected ? 'none' : 'block', md: 'block' } }}
          >
            <SectionCard>
              <Typography variant="h3" sx={{ mb: 1 }}>
                Your requests
              </Typography>
              <Stack divider={<Divider flexItem />}>
                {cases.map((supportCase) => (
                  <Box
                    component="button"
                    key={supportCase.id}
                    onClick={() => setSelectedId(supportCase.id)}
                    sx={{
                      width: '100%',
                      border: 0,
                      color: 'inherit',
                      textAlign: 'left',
                      bgcolor: selectedId === supportCase.id ? 'action.selected' : 'transparent',
                      borderRadius: 2,
                      px: 1.25,
                      py: 1.5,
                      cursor: 'pointer',
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography sx={{ fontWeight: 850, flex: 1 }} noWrap>
                        {supportCase.subject}
                      </Typography>
                      {supportCase.priority !== 'NORMAL' && (
                        <Chip
                          size="small"
                          color={supportCase.priority === 'URGENT' ? 'error' : 'warning'}
                          label={supportCase.priority === 'URGENT' ? 'Urgent' : 'High'}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {categoryLabels[supportCase.category]} · {statusLabels[supportCase.status]}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          </Grid>
          <Grid
            size={{ xs: 12, md: 7, lg: 8 }}
            sx={{ display: { xs: selected ? 'block' : 'none', md: 'block' } }}
          >
            {selected && (
              <SectionCard sx={{ p: { xs: 1.5, sm: 3 } }}>
                <Stack spacing={{ xs: 2, sm: 2.5 }}>
                  <Box
                    sx={{
                      display: { xs: 'block', md: 'none' },
                      position: 'sticky',
                      top: 68,
                      zIndex: 5,
                      mx: -1.5,
                      mt: -1.5,
                      px: 1.5,
                      py: 1,
                      bgcolor: 'rgba(16,24,44,0.98)',
                      backdropFilter: 'blur(14px)',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Button
                      size="small"
                      startIcon={<ArrowBackRounded />}
                      onClick={() => setSelectedId(null)}
                      sx={{ px: 0.5 }}
                    >
                      Back to requests
                    </Button>
                  </Box>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{ alignItems: { sm: 'flex-start' } }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="h3" sx={{ overflowWrap: 'anywhere' }}>
                            {selected.subject}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {categoryLabels[selected.category]} · Opened{' '}
                            {new Date(selected.createdAt).toLocaleDateString()}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              mt: 0.25,
                              color: priorityColors[selected.priority],
                              fontWeight: 850,
                            }}
                          >
                            {priorityLabels[selected.priority]} priority
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          color={
                            selected.status === 'WAITING_ON_CLIENT'
                              ? 'warning'
                              : selected.status === 'RESOLVED'
                                ? 'success'
                                : 'info'
                          }
                          label={statusLabels[selected.status]}
                        />
                      </Stack>
                    </Box>
                    {selected.status === 'RESOLVED' ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => updateStatus.mutate('OPEN')}
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                      >
                        Reopen request
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<CheckCircleOutlineRounded />}
                        onClick={() => updateStatus.mutate('RESOLVED')}
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                      >
                        Mark resolved
                      </Button>
                    )}
                  </Stack>
                  {selected.context && selected.context.type !== 'GENERAL' && (
                    <Alert severity="info">Linked context: {selected.context.summary}</Alert>
                  )}
                  {!!selected.attachments?.length && (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {selected.attachments.map(({ document }) => (
                        <Button
                          key={document.id}
                          size="small"
                          variant="outlined"
                          href={`/api/v1/documents/${document.id}/content`}
                        >
                          {document.displayFileName}
                        </Button>
                      ))}
                    </Stack>
                  )}
                  <Divider />
                  <Stack
                    spacing={1.5}
                    sx={{
                      p: { xs: 2, sm: 2.25 },
                      bgcolor: 'rgba(7,11,24,0.34)',
                      borderRadius: 3,
                    }}
                  >
                    {selected.messages.map((item) => {
                      const mine = item.author.id === user?.userId;
                      return (
                        <Box
                          key={item.id}
                          sx={{
                            alignSelf: mine ? 'flex-end' : 'flex-start',
                            maxWidth: { xs: '92%', sm: '82%' },
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', px: 0.5, textAlign: mine ? 'right' : 'left' }}
                          >
                            {mine ? 'You' : 'Support team'} ·{' '}
                            {new Date(item.createdAt).toLocaleString()}
                          </Typography>
                          <Box
                            sx={{
                              mt: 0.4,
                              px: 2,
                              py: 1.4,
                              borderRadius: 2.5,
                              bgcolor: mine ? 'primary.main' : 'action.hover',
                              color: mine ? 'primary.contrastText' : 'text.primary',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {item.body}
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                  {selected.status !== 'CLOSED' && selected.status !== 'RESOLVED' && (
                    <Stack spacing={1.25} sx={{ pt: 0.5 }}>
                      <TextField
                        label="Reply"
                        multiline
                        minRows={3}
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        helperText={
                          reply.trim().length === 0 ? 'Enter a message to enable Send reply.' : ' '
                        }
                      />
                      {sendReply.isError && (
                        <Alert severity="error">{sendReply.error.message}</Alert>
                      )}
                      <Button
                        variant="contained"
                        startIcon={<SendRounded />}
                        onClick={() => sendReply.mutate()}
                        disabled={reply.trim().length === 0 || sendReply.isPending}
                        sx={{
                          alignSelf: { xs: 'stretch', sm: 'flex-end' },
                        }}
                      >
                        {sendReply.isPending ? 'Sending…' : 'Send reply'}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </SectionCard>
            )}
          </Grid>
        </Grid>
      )}

      <Dialog
        open={newRequestOpen}
        onClose={() => setNewRequestOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>New support request</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Box>
              <Typography sx={{ fontWeight: 850, mb: 1 }}>What do you need help with?</Typography>
              <ToggleButtonGroup
                exclusive
                value={category}
                onChange={(_, value: SupportCategory | null) => value && setCategory(value)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' },
                  gap: 1,
                  '& .MuiToggleButtonGroup-grouped': {
                    m: 0,
                    border: '1px solid !important',
                    borderColor: 'divider !important',
                    borderRadius: '12px !important',
                  },
                  '& .Mui-selected': { borderColor: 'primary.main !important' },
                }}
              >
                {(
                  categoryQuery.data?.categories ?? categories.map(([key, name]) => ({ key, name }))
                ).map(({ key, name }) => (
                  <ToggleButton key={key} value={key}>
                    {name}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 850, mb: 1 }}>Priority</Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={priority}
                onChange={(_, value: typeof priority | null) => value && setPriority(value)}
              >
                <ToggleButton value="NORMAL">Normal</ToggleButton>
                <ToggleButton value="HIGH">High</ToggleButton>
                <ToggleButton value="URGENT">Urgent</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <TextField
              label="Subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
            <TextField
              label="How can we help?"
              multiline
              minRows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <TextField
              select
              label="Attach existing documents (optional)"
              value={attachmentDocumentIds}
              onChange={(event) =>
                setAttachmentDocumentIds(
                  typeof event.target.value === 'string'
                    ? event.target.value.split(',')
                    : event.target.value,
                )
              }
              slotProps={{ select: { multiple: true } }}
              helperText="Upload new files in Documents first, then attach them here."
            >
              {(documentQuery.data?.documents ?? []).map((document) => (
                <MenuItem key={document.id} value={document.id}>
                  {document.displayFileName}
                </MenuItem>
              ))}
            </TextField>
            {contextType !== 'GENERAL' && (
              <Alert severity="info">
                This request will include the linked {contextType.toLowerCase().replace('_', ' ')}
                context only. No broader profile data is shared.
              </Alert>
            )}
            {createCase.isError && <Alert severity="error">{createCase.error.message}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            py: 1.5,
            gap: 1,
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button onClick={() => setNewRequestOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<ForumRounded />}
            onClick={() => createCase.mutate()}
            disabled={
              subject.trim().length < 4 || message.trim().length < 10 || createCase.isPending
            }
            sx={{
              minWidth: { xs: 158, sm: 180 },
            }}
          >
            {createCase.isPending ? 'Submitting…' : 'Submit request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
