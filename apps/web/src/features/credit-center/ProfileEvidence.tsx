import { Box, Stack, Typography } from '@mui/material';
import type { CreditExperience, ReportAccount } from './data';

/** Compare observed facts only. Missing bureau inputs are not evidence of a difference. */
export function observedBureauDifferences(accounts: ReportAccount[] | null) {
  return (accounts ?? []).filter((a) => {
    const balances = a.bureaus
      .filter((b) => b.balance.value !== null && ['KNOWN', 'PARTIAL'].includes(b.balance.quality))
      .map((b) => b.balance.value);
    const limits = a.bureaus
      .filter((b) => b.limit.value !== null && ['KNOWN', 'PARTIAL'].includes(b.limit.quality))
      .map((b) => b.limit.value);
    const statuses = a.bureaus.filter((b) => b.status !== null).map((b) => b.status);
    return new Set(balances).size > 1 || new Set(limits).size > 1 || new Set(statuses).size > 1;
  });
}

export function ProfileEvidence({ data, section }: { data: CreditExperience; section: string }) {
  const accounts = data.accounts;
  if (section === 'inquiries')
    return data.inquiries === null ? (
      <Typography color="text.secondary">
        Inquiry dates, bureau details and a defined date window were not supplied.
      </Typography>
    ) : (
      <Stack spacing={2}>
        {!data.inquiries.length && (
          <Typography>No inquiries were included in this report section.</Typography>
        )}
        {[...data.inquiries]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 5)
          .map((q, i) => (
            <Box key={i} sx={{ borderLeft: 2, borderColor: 'primary.main', pl: 2 }}>
              <Typography>
                {q.date} · {q.bureau}
              </Typography>
              <Typography>
                {q.creditor} · {q.type ?? 'Type not supplied'}
              </Typography>
            </Box>
          ))}
      </Stack>
    );
  if (section === 'negatives')
    return data.negatives === null ? (
      <Typography color="text.secondary">
        Individual negative-item evidence is not available in this publication.
      </Typography>
    ) : (
      <Stack spacing={2}>
        {!data.negatives.length && (
          <Typography>No negative items were included in this report section.</Typography>
        )}
        {data.negatives.slice(0, 3).map((n, i) => (
          <Box key={i}>
            <Typography>
              {n.title} · {n.bureau}
            </Typography>
            <Typography color="text.secondary">
              {n.status ?? 'Status not supplied'} · {n.date ?? 'Date not supplied'}
            </Typography>
          </Box>
        ))}
      </Stack>
    );
  if (accounts === null)
    return (
      <Typography color="text.secondary">
        Individual account facts are not available in this publication.
      </Typography>
    );
  if (!accounts.length)
    return <Typography>No accounts were included in this report section.</Typography>;
  if (section === 'accounts') {
    const groups = Object.entries(
      accounts.reduce<Record<string, number>>((all, a) => {
        const type = a.type?.toLowerCase();
        const key =
          type === 'revolving'
            ? 'Revolving'
            : type === 'installment'
              ? 'Installment'
              : type === 'mortgage'
                ? 'Mortgage'
                : 'Other / unknown';
        all[key] = (all[key] ?? 0) + 1;
        return all;
      }, {}),
    );
    return (
      <Stack spacing={2}>
        <Box
          role="img"
          aria-label={groups.map(([type, count]) => `${type}: ${count}`).join('; ')}
          sx={{ display: 'flex', height: 12, borderRadius: 2, overflow: 'hidden', gap: '2px' }}
        >
          {groups.map(([type, count], i) => (
            <Box
              key={type}
              sx={{
                width: `${(count / accounts.length) * 100}%`,
                bgcolor: ['#68d5bd', '#329e91', '#6598ad', '#75848e'][i],
              }}
            />
          ))}
        </Box>
        {groups.map(([type, count]) => (
          <Box key={type}>
            <Typography>
              {type} · {count} of {accounts.length} reported accounts
            </Typography>
            <Box
              role="img"
              aria-label={type + ': ' + count + ' accounts'}
              sx={{ height: 8, bgcolor: 'divider', mt: 1, borderRadius: 2 }}
            >
              <Box
                sx={{
                  height: '100%',
                  width: `${(count / accounts.length) * 100}%`,
                  bgcolor: 'primary.main',
                  borderRadius: 2,
                }}
              />
            </Box>
          </Box>
        ))}
      </Stack>
    );
  }
  if (section === 'age')
    return (
      <Stack
        component="ol"
        spacing={2}
        sx={{
          pl: 2,
          ml: 1,
          borderLeft: 2,
          borderColor: 'divider',
          '& li::marker': { color: 'primary.main' },
        }}
      >
        {accounts
          .filter((a) => a.openedAt)
          .sort((a, b) => a.openedAt!.localeCompare(b.openedAt!))
          .map((a) => (
            <Box component="li" key={a.id} sx={{ pl: 1 }}>
              <Typography>
                {a.openedAt} · {a.creditor}
              </Typography>
            </Box>
          ))}
        <Typography variant="caption" color="text.secondary">
          Opening dates are shown where supplied. {accounts.filter((a) => !a.openedAt).length}{' '}
          accounts have no opening date. No credit-quality grade is inferred.
        </Typography>
      </Stack>
    );
  if (section === 'payment')
    return (
      <Stack spacing={2}>
        {accounts
          .filter(
            (a) =>
              a.paymentStatus &&
              !['current', 'paid', 'on time'].includes(a.paymentStatus.toLowerCase()),
          )
          .slice(0, 3)
          .map((a) => (
            <Box key={a.id}>
              <Typography>
                {a.creditor} · {a.paymentStatus ?? 'Payment status not supplied'}
              </Typography>
              <Typography variant="caption">
                Reported {a.reportedAt ?? 'date not supplied'}
              </Typography>
            </Box>
          ))}
      </Stack>
    );
  if (section === 'bureaus')
    return (
      <Stack spacing={2}>
        {observedBureauDifferences(accounts)
          .slice(0, 5)
          .map((a) => (
            <Box key={a.id}>
              <Typography>{a.creditor}</Typography>
              {a.bureaus.map((b) => (
                <Typography key={b.name} variant="body2" color="text.secondary">
                  {b.name} · balance{' '}
                  {b.balance.value === null
                    ? 'not available'
                    : '$' + b.balance.value.toLocaleString()}{' '}
                  · limit{' '}
                  {b.limit.value === null ? 'not available' : '$' + b.limit.value.toLocaleString()}{' '}
                  · {b.status ?? 'Status not supplied'}
                </Typography>
              ))}
            </Box>
          ))}
      </Stack>
    );
  return null;
}
