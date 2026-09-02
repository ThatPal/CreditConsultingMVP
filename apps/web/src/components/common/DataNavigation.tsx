import ClearRounded from '@mui/icons-material/ClearRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';

export function DataNavigationToolbar({
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  activeFilters = [],
  onClearFilters,
  resultLabel,
  loading = false,
  children,
}: {
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeFilters?: string[];
  onClearFilters?: () => void;
  resultLabel?: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      aria-label="Data navigation controls"
      sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(7, 19, 39, .7)' }}
    >
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
          <TextField
            size="small"
            label={searchLabel}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            sx={{ flex: 1, minWidth: { md: 280 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchValue ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      aria-label={`Clear ${searchLabel.toLowerCase()}`}
                      onClick={() => onSearchChange('')}
                    >
                      <ClearRounded fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
          {children}
        </Stack>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignItems: { sm: 'center' }, minHeight: 28 }}
        >
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, flex: 1 }}>
            {activeFilters.map((filter) => (
              <Chip key={filter} size="small" label={filter} variant="outlined" />
            ))}
            {activeFilters.length > 0 && onClearFilters && (
              <Button size="small" onClick={onClearFilters} startIcon={<ClearRounded />}>
                Clear filters
              </Button>
            )}
          </Stack>
          {resultLabel && (
            <Typography variant="caption" color="text.secondary" aria-live="polite">
              {loading && <CircularProgress size={12} sx={{ mr: 0.75 }} />}
              {resultLabel}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

export function DataPagination({
  page,
  pageSize,
  total,
  hasMore,
  onPageChange,
  loading = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  loading?: boolean;
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const numberedPages = Array.from(
    new Set(
      [1, page - 1, page, page + 1, pageCount].filter((value) => value >= 1 && value <= pageCount),
    ),
  );
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, pt: 2 }}
    >
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {total === 0 ? 'No results' : `Showing ${first}–${last} of ${total}`}
      </Typography>
      <Box
        component="nav"
        aria-label="Pagination"
        sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}
      >
        <Button
          variant="outlined"
          disabled={page === 1 || loading}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        {numberedPages.map((pageNumber) => (
          <Button
            key={pageNumber}
            variant={pageNumber === page ? 'contained' : 'outlined'}
            aria-label={`Page ${pageNumber}`}
            aria-current={pageNumber === page ? 'page' : undefined}
            disabled={loading || pageNumber === page}
            onClick={() => onPageChange(pageNumber)}
            sx={{ minWidth: 40 }}
          >
            {pageNumber}
          </Button>
        ))}
        <Button
          variant="outlined"
          disabled={!hasMore || loading}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </Box>
    </Stack>
  );
}
