import { useRef, useState } from 'react';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBlobRequest, apiRequest } from '../../auth/api';
import { DocumentPicker } from '../../components/common/DocumentPicker';
import {
  DocumentUploadDropzone,
  type UploadDocumentType,
} from '../../components/common/DocumentUploadDropzone';

export type PlanFile = {
  documentId: string;
  fileName: string;
  sizeBytes: number;
  available: boolean;
  status: string;
};

export function EvidenceFile({ file }: { file: PlanFile }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    setBusy(true);
    setError('');
    try {
      const blob = await apiBlobRequest(`/api/v1/documents/${file.documentId}/content`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The file could not be downloaded. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      <Button
        variant="outlined"
        disabled={!file.available || busy}
        onClick={() => void download()}
        sx={{ justifyContent: 'flex-start', overflowWrap: 'anywhere' }}
      >
        {busy ? 'Downloading...' : `Download ${file.fileName}`}
      </Button>
      <Typography variant="caption" color="text.secondary">
        {Math.max(1, Math.round(file.sizeBytes / 1024))} KB
        {!file.available
          ? ' · File unavailable; the submission record is retained.'
          : file.status === 'SUPERSEDED'
            ? ' · Original submitted version; a newer file exists in Documents.'
            : ' · Submitted version'}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

export function PlanAttachments({
  value,
  onChange,
  disabled,
  onBusyChange,
}: {
  value: PlanFile[];
  onChange: (files: PlanFile[]) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(value.length > 0);
  const [upload, setUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState('');
  const known = useRef<Record<string, PlanFile>>({});
  const client = useQueryClient();
  const types = useQuery({
    queryKey: ['client-document-types'],
    queryFn: () => apiRequest<{ documentTypes: UploadDocumentType[] }>('/api/v1/documents/types'),
    enabled: expanded,
  });
  const selectedType =
    types.data?.documentTypes.find((row) => row.key === type) ?? types.data?.documentTypes[0];
  return (
    <Stack spacing={1.5}>
      <Button
        disabled={disabled || busy}
        onClick={() => setExpanded(!expanded)}
        sx={{ alignSelf: 'flex-start' }}
      >
        {expanded ? 'Hide attachments' : 'Add supporting documents (optional)'}
      </Button>
      {expanded && (
        <>
          <Typography variant="body2" color="text.secondary">
            Attach up to five private documents for your consultant to review with this response.
            Removing an attachment here keeps the file in Documents.
          </Typography>
          {value.map((file) => (
            <Stack key={file.documentId} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="body2" sx={{ flex: 1, overflowWrap: 'anywhere', minWidth: 0 }}>
                {file.fileName}
              </Typography>
              <Button
                disabled={disabled || busy}
                onClick={() => onChange(value.filter((row) => row.documentId !== file.documentId))}
                aria-label={`Remove ${file.fileName}`}
              >
                Remove
              </Button>
            </Stack>
          ))}
          <DocumentPicker
            value={value.map((file) => file.documentId)}
            disabled={disabled || busy}
            documentTypes={types.data?.documentTypes ?? []}
            onDocumentSelected={(document) => {
              known.current[document.id] = {
                documentId: document.id,
                fileName: document.displayFileName,
                sizeBytes: document.sizeBytes,
                status: document.status,
                available: true,
              };
            }}
            onChange={(ids) =>
              onChange(
                ids
                  .map((id) => value.find((file) => file.documentId === id) ?? known.current[id]!)
                  .filter(Boolean),
              )
            }
          />
          <Button
            disabled={disabled || busy || value.length >= 5}
            onClick={() => setUpload(!upload)}
            sx={{ alignSelf: 'flex-start' }}
          >
            {upload ? 'Cancel upload' : 'Upload a new document'}
          </Button>
          {types.isError && (
            <Alert
              severity="error"
              action={<Button onClick={() => void types.refetch()}>Retry</Button>}
            >
              Document types could not be loaded.
            </Alert>
          )}
          {upload && selectedType && (
            <>
              <TextField
                select
                label="Document type"
                value={selectedType.key}
                disabled={disabled || busy}
                onChange={(event) => setType(event.target.value)}
              >
                {types.data?.documentTypes.map((row) => (
                  <MenuItem key={row.key} value={row.key}>
                    {row.name}
                  </MenuItem>
                ))}
              </TextField>
              <DocumentUploadDropzone
                documentType={selectedType}
                onCheckExisting={() => {
                  setUpload(false);
                  void client.invalidateQueries({ queryKey: ['document-picker'] });
                  void client.invalidateQueries({ queryKey: ['client-documents'] });
                }}
                disabled={disabled || value.length >= 5}
                onBusyChange={(next) => {
                  setBusy(next);
                  onBusyChange(next);
                }}
                onUploaded={async (document) => {
                  onChange([
                    ...value,
                    {
                      documentId: document.id,
                      fileName: document.displayFileName,
                      sizeBytes: document.sizeBytes,
                      status: 'AVAILABLE',
                      available: true,
                    },
                  ]);
                  await Promise.all(
                    ['document-picker', 'client-documents'].map((key) =>
                      client.invalidateQueries({ queryKey: [key] }),
                    ),
                  );
                }}
              />
            </>
          )}
          {upload && types.isLoading && (
            <Typography role="status">Loading upload options...</Typography>
          )}
          {upload && types.isSuccess && !selectedType && (
            <Alert severity="info">
              No document types are available for upload. You can still select existing documents.
            </Alert>
          )}
        </>
      )}
    </Stack>
  );
}
