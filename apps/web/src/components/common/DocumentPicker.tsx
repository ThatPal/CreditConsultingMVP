import SearchRounded from '@mui/icons-material/SearchRounded';
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../../auth/api';

export type PickerDocument = {
  id: string;
  displayFileName: string;
  sizeBytes: number;
  uploadedAt: string;
  status: string;
  documentType: { key: string; name: string };
};

export function DocumentPicker({
  value,
  onChange,
  documentTypes,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  documentTypes: Array<{ key: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: '10', status: 'AVAILABLE' });
  if (search.trim()) params.set('search', search.trim());
  if (type) params.set('type', type);
  const query = useQuery({
    queryKey: ['document-picker', search, type, page],
    queryFn: () =>
      apiRequest<{ documents: PickerDocument[]; hasMore: boolean; total: number }>(
        `/api/v1/documents?${params}`,
      ),
    enabled: open,
  });
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id].slice(0, 5));

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
        <Button variant="outlined" startIcon={<SearchRounded />} onClick={() => setOpen(true)}>
          Attach existing documents
        </Button>
        <Typography variant="body2" color="text.secondary">
          {value.length ? `${value.length} selected` : 'Optional · up to five'}
        </Typography>
      </Stack>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="document-picker-title">
        <DialogTitle id="document-picker-title">Choose existing documents</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Search documents"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              helperText="Search by filename or document type"
              autoFocus
            />
            <FormControl fullWidth>
              <InputLabel id="document-picker-type-label">Document type</InputLabel>
              <Select
                labelId="document-picker-type-label"
                label="Document type"
                value={type}
                onChange={(event) => { setType(event.target.value); setPage(1); }}
              >
                <MenuItem value="">All types</MenuItem>
                {documentTypes.map((item) => <MenuItem key={item.key} value={item.key}>{item.name}</MenuItem>)}
              </Select>
            </FormControl>
            {query.isError && <Typography color="error">Unable to load documents.</Typography>}
            <List aria-label="Available existing documents" disablePadding>
              {(query.data?.documents ?? []).map((document) => (
                <ListItemButton key={document.id} onClick={() => toggle(document.id)} disabled={!value.includes(document.id) && value.length >= 5}>
                  <Checkbox checked={value.includes(document.id)} tabIndex={-1} />
                  <ListItemText
                    primary={document.displayFileName}
                    secondary={`${document.documentType.name} · ${new Date(document.uploadedAt).toLocaleDateString()} · ${Math.max(1, Math.round(document.sizeBytes / 1024))} KB`}
                  />
                  {value.includes(document.id) && <Chip size="small" label="Selected" />}
                </ListItemButton>
              ))}
            </List>
            {!query.isLoading && query.data?.documents.length === 0 && <Typography color="text.secondary">No documents match this search.</Typography>}
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <Typography variant="body2">Page {page}</Typography>
              <Button disabled={!query.data?.hasMore} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onChange([])} disabled={!value.length}>Clear</Button>
          <Button variant="contained" onClick={() => setOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
