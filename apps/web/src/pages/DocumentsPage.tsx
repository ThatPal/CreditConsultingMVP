import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import {
  DocumentUploadDropzone,
  type UploadDocumentType,
} from '../components/common/DocumentUploadDropzone';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { SecureReportViewer } from './ReviewPages';

type ClientDocument = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  supersededAt: string | null;
  displayFileName: string;
  sha256: string;
  status: string;
  documentType: { key: string; name: string };
};

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPage() {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const theme = useTheme();
  const fullScreenViewer = useMediaQuery(theme.breakpoints.down('sm'));
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search.trim()) params.set('search', search.trim());
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  const query = useQuery({
    queryKey: ['client-documents', search, type, status, page],
    queryFn: () => apiRequest<{ documents: ClientDocument[]; hasMore: boolean; total: number }>(`/api/v1/documents?${params}`),
    placeholderData: keepPreviousData,
  });
  const typesQuery = useQuery({
    queryKey: ['client-document-types'],
    queryFn: () => apiRequest<{ documentTypes: UploadDocumentType[] }>('/api/v1/documents/types'),
  });

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) return <Alert severity="error">Unable to load your document history.</Alert>;

  const documents = query.data?.documents ?? [];
  const selected = documents.find((document) => document.id === selectedDocumentId);

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Secure files"
        title="Documents"
        description="Your private, authorized document library. Files are available only through protected application access."
      />

      {typesQuery.data?.documentTypes.length ? (
        <SectionCard>
          <Stack spacing={1.5}>
            <Typography variant="h3">Upload a document</Typography>
            <DocumentUploadDropzone
              documentType={typesQuery.data.documentTypes[0]!}
              title="Add to your secure document library"
              onUploaded={async () => {
                await queryClient.invalidateQueries({ queryKey: ['client-documents'] });
              }}
            />
          </Stack>
        </SectionCard>
      ) : null}

      {documents.length === 0 ? (
        <SectionCard>
          <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
            <DescriptionRounded color="primary" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h3">No documents yet</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Upload an allowed document to make it available in your secure library.
              </Typography>
            </Box>
            <Button component={Link} to="/client/credit-profile" variant="contained">
              Go to Credit Profile
            </Button>
          </Stack>
        </SectionCard>
      ) : (
        <SectionCard>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField label="Search documents" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} sx={{ flex: 1 }} />
            <TextField select label="Document type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} sx={{ minWidth: 180 }}>
              <MenuItem value="">All types</MenuItem>
              {(typesQuery.data?.documentTypes ?? []).map((item) => <MenuItem key={item.key} value={item.key}>{item.name}</MenuItem>)}
            </TextField>
            <TextField select label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} sx={{ minWidth: 170 }}>
              <MenuItem value="">All statuses</MenuItem><MenuItem value="AVAILABLE">Available</MenuItem><MenuItem value="SUPERSEDED">Previous versions</MenuItem>
            </TextField>
          </Stack>
          <Stack divider={<Divider flexItem />}>
            {documents.map((document) => (
              <Stack
                key={document.id}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ py: 2, alignItems: { sm: 'center' } }}
              >
                <DescriptionRounded color="primary" sx={{ fontSize: 34 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 850, overflowWrap: 'anywhere' }}>
                    {document.displayFileName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    Uploaded {new Date(document.uploadedAt).toLocaleDateString()} ·{' '}
                    {fileSize(document.sizeBytes)} · {document.documentType.name}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip
                    size="small"
                    color={document.status === 'AVAILABLE' ? 'success' : 'default'}
                    label={document.status === 'AVAILABLE' ? 'Available' : 'Previous version'}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<VisibilityRounded />}
                    onClick={() => setSelectedDocumentId(document.id)}
                  >
                    View
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            <Button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Typography variant="body2">Page {page} · {query.data?.total ?? 0} documents</Typography>
            <Button disabled={!query.data?.hasMore} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </Stack>
        </SectionCard>
      )}

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelectedDocumentId(null)}
        fullScreen={fullScreenViewer}
        fullWidth
        maxWidth="lg"
        slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}
      >
        {selected && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <DescriptionRounded color="primary" />
                <Typography variant="h3" sx={{ flex: 1, overflowWrap: 'anywhere' }}>
                  {selected.displayFileName}
                </Typography>
                <IconButton
                  aria-label="Close document viewer"
                  onClick={() => setSelectedDocumentId(null)}
                >
                  <CloseRounded />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers sx={{ p: { xs: 1, sm: 2 } }}>
              <SecureReportViewer
                documentId={selected.id}
                contentPath={`/api/v1/documents/${selected.id}/content`}
              />
            </DialogContent>
          </>
        )}
      </Dialog>
    </Stack>
  );
}
