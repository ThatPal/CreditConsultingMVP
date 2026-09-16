import { Link, useSearchParams } from 'react-router-dom';
import { useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { CreditDataValue } from './CreditData';
import type { ReportAccount } from './data';

export function ReportAccounts({ accounts }: { accounts: ReportAccount[] | null }) {
  const [index, setIndex] = useState(0),
    [all, setAll] = useState(false),
    [filter, setFilter] = useState('');
  const [search, setSearch] = useSearchParams();
  const detail = accounts?.find((a) => a.id === search.get('account')) ?? null;
  const setDetail = (account: ReportAccount | null) =>
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      if (account) next.set('account', account.id);
      else next.delete('account');
      return next;
    });
  const narrow = useMediaQuery(useTheme().breakpoints.down('md'));
  const touch = useRef<number | null>(null);
  const items = accounts ?? [];
  const galleryIndex = Math.min(index, Math.max(0, items.length - 1));
  const item = items[galleryIndex];
  const move = (n: number) => setIndex((i) => Math.max(0, Math.min(items.length - 1, i + n)));
  return (
    <Box component="section" id="accounts">
      {search.get('account') && !detail && (
        <Box role="status" sx={{ mb: 2 }}>
          <Typography>This account is not available in this report.</Typography>
          <Button onClick={() => setDetail(null)}>Return to report accounts</Button>
        </Box>
      )}
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}
      >
        <Typography variant="h2">Report accounts</Typography>
        {items.length > 0 && (
          <Button onClick={() => setAll(!all)}>
            {all ? 'Return to gallery' : 'View all accounts'}
          </Button>
        )}
      </Stack>
      {accounts === null ? (
        <Typography color="text.secondary">
          Individual accounts are not available in this published report digest. Open the secure
          original report for the source evidence.
        </Typography>
      ) : !items.length ? (
        <Typography>No accounts were included in this report’s account section.</Typography>
      ) : all ? (
        <Stack spacing={2}>
          <TextField
            label="Find an account"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {!items.some((a) =>
            [a.creditor, a.type, a.status].join(' ').toLowerCase().includes(filter.toLowerCase()),
          ) && <Typography>No accounts match this search.</Typography>}
          {items
            .filter((a) =>
              [a.creditor, a.type, a.status].join(' ').toLowerCase().includes(filter.toLowerCase()),
            )
            .map((a) => (
              <Button
                key={a.id}
                onClick={() => setDetail(a)}
                sx={{
                  justifyContent: 'space-between',
                  p: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <span>{a.creditor}</span>
                <span>
                  {a.type ?? 'Type unavailable'} · {a.status ?? 'Status unavailable'}
                </span>
              </Button>
            ))}
        </Stack>
      ) : (
        item && (
          <Box
            onTouchStart={(e) => {
              touch.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (touch.current !== null) {
                const d = (e.changedTouches[0]?.clientX ?? touch.current) - touch.current;
                if (Math.abs(d) > 45) move(d < 0 ? 1 : -1);
              }
              touch.current = null;
            }}
            sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', py: 3 }}
          >
            <Box aria-live="polite">
              <Typography variant="overline">
                {item.type ?? 'Account type not supplied'} · {item.status ?? 'Status not supplied'}
              </Typography>
              <Typography variant="h3">{item.creditor}</Typography>
              <Typography color="text.secondary">{item.maskedIdentifier}</Typography>
              <Stack direction="row" spacing={4} sx={{ my: 3 }}>
                <Box>
                  <Typography variant="caption">Reported balance</Typography>
                  <CreditDataValue fact={item.balance} money />
                </Box>
                <Box>
                  <Typography variant="caption">Reported limit</Typography>
                  <CreditDataValue fact={item.limit} money />
                </Box>
              </Stack>
              <Typography variant="body2">
                Reported {item.reportedAt ?? 'date not supplied'} ·{' '}
                {item.bureaus.map((b) => b.name).join(', ') || 'Bureau coverage not supplied'}
              </Typography>
            </Box>
            <Stack
              direction="row"
              sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                mt: 2,
              }}
            >
              <Button onClick={() => move(-1)} disabled={index === 0}>
                Previous account
              </Button>
              <Typography variant="caption">
                {galleryIndex + 1} of {items.length}
              </Typography>
              <Button onClick={() => move(1)} disabled={index >= items.length - 1}>
                Next account
              </Button>
              <Button variant="outlined" onClick={() => setDetail(item)}>
                Open account detail
              </Button>
            </Stack>
          </Box>
        )
      )}
      <Dialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        fullScreen={narrow}
        fullWidth
        maxWidth="sm"
        aria-labelledby="account-detail-title"
        slotProps={{
          paper: {
            sx: narrow
              ? {}
              : { m: 0, ml: 'auto', height: '100%', maxHeight: '100%', borderRadius: 0 },
          },
        }}
      >
        <DialogTitle id="account-detail-title">{detail?.creditor}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {detail && (
              <>
                <Typography>
                  {detail.type ?? 'Type not supplied'} · {detail.status ?? 'Status not supplied'}
                </Typography>
                <Typography>{detail.maskedIdentifier}</Typography>
                <Typography variant="overline">Balance</Typography>
                <CreditDataValue fact={detail.balance} money />
                <Typography variant="overline">Limit</Typography>
                <CreditDataValue fact={detail.limit} money />
                <Typography>Opened: {detail.openedAt ?? 'Not available in this report'}</Typography>
                <Typography>
                  Reported: {detail.reportedAt ?? 'Not available in this report'}
                </Typography>
                <Typography>
                  Payment status: {detail.paymentStatus ?? 'Not available in this report'}
                </Typography>
                <Typography>{detail.remarks ?? 'No published remarks supplied.'}</Typography>
                <Typography variant="h4" component="h2">
                  Bureau details
                </Typography>
                {detail.bureaus.map((b) => (
                  <Box key={b.name}>
                    <Typography>
                      {b.name} · {b.status ?? 'Status not supplied'}
                    </Typography>
                    <CreditDataValue fact={b.balance} money />
                    <CreditDataValue fact={b.limit} money />
                  </Box>
                ))}
                {detail.cardHref && /^\/app\/cards\/[A-Za-z0-9_-]+$/.test(detail.cardHref) && (
                  <Button component={Link} to={detail.cardHref}>
                    Open matched Card
                  </Button>
                )}
                <Typography variant="h4" component="h2">
                  Payment history
                </Typography>
                {detail.paymentHistory.length ? (
                  detail.paymentHistory.map((p, i) => (
                    <Typography key={i}>
                      {p.month} · {p.status}
                    </Typography>
                  ))
                ) : (
                  <Typography>Not available in this report.</Typography>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>Close account detail</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
