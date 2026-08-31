import CloudUploadRounded from '@mui/icons-material/CloudUploadRounded';
import InsertDriveFileRounded from '@mui/icons-material/InsertDriveFileRounded';
import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { apiFileRequest } from '../../auth/api';

export type UploadDocumentType = {
  key: string;
  name: string;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maximumSizeBytes: number;
};

export type UploadedDocument = {
  id: string;
  displayFileName: string;
  mimeType: string;
  sizeBytes: number;
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;
}

function extensionOf(name: string) {
  const index = name.lastIndexOf('.');
  return index < 0 ? '' : name.slice(index).toLowerCase();
}

export function DocumentUploadDropzone({
  documentType,
  onUploaded,
  onBusyChange,
  title = 'Upload a document',
}: {
  documentType: UploadDocumentType;
  onUploaded: (document: UploadedDocument) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  title?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const guidance = `${documentType.allowedExtensions.join(', ')} up to ${formatSize(documentType.maximumSizeBytes)}`;

  async function submit(file?: File) {
    if (!file || uploading) return;
    setError(null);
    setSuccess(null);
    const extension = extensionOf(file.name);
    if (
      !documentType.allowedMimeTypes.includes(file.type.toLowerCase()) ||
      !documentType.allowedExtensions.includes(extension)
    ) {
      setError(`Choose an accepted file: ${guidance}.`);
      return;
    }
    if (file.size > documentType.maximumSizeBytes) {
      setError(
        `This file is too large. Choose a file no larger than ${formatSize(documentType.maximumSizeBytes)}.`,
      );
      return;
    }
    try {
      setUploading(true);
      onBusyChange?.(true);
      const result = await apiFileRequest<{ document: UploadedDocument }>(
        '/api/v1/documents',
        file,
        documentType.key,
      );
      await onUploaded(result.document);
      setSuccess(`${result.document.displayFileName} uploaded successfully.`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'The file could not be uploaded. Please try again.',
      );
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  }

  return (
    <Stack spacing={1.5}>
      <Box
        data-testid="document-upload-dropzone"
        onDragEnter={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void submit(event.dataTransfer.files?.[0]);
        }}
        sx={{
          border: '2px dashed',
          borderColor: dragging ? 'primary.main' : 'divider',
          borderRadius: 3,
          p: { xs: 2, sm: 3 },
          bgcolor: dragging ? 'action.selected' : 'action.hover',
          textAlign: 'center',
          transition: (theme) =>
            theme.transitions.create(['background-color', 'border-color'], {
              duration: theme.transitions.duration.shortest,
            }),
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}
      >
        <Stack spacing={1.25} sx={{ alignItems: 'center' }}>
          {dragging ? (
            <InsertDriveFileRounded color="primary" sx={{ fontSize: 42 }} />
          ) : (
            <CloudUploadRounded color="primary" sx={{ fontSize: 42 }} />
          )}
          <Box>
            <Typography sx={{ fontWeight: 850 }}>
              {dragging ? 'Release to upload this file' : title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Drag and drop here, or select a file from your device.
            </Typography>
          </Box>
          <Button
            variant="contained"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Select file'}
          </Button>
          <input
            ref={inputRef}
            hidden
            type="file"
            aria-label="Choose file to upload"
            accept={documentType.allowedMimeTypes.join(',')}
            disabled={uploading}
            onChange={(event) => {
              void submit(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Accepted: {guidance}
          </Typography>
        </Stack>
      </Box>
      {uploading && <LinearProgress aria-label="Document upload progress" />}
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
    </Stack>
  );
}
