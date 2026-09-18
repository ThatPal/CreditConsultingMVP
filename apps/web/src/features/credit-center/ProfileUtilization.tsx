import { Box, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { CreditDataValue } from './CreditData';
import { type CreditExperience, type CreditValue, unknownValue } from './data';

const usable = (fact?: CreditValue): fact is CreditValue & { value: number } =>
  !!fact &&
  ['KNOWN', 'PARTIAL'].includes(fact.quality) &&
  fact.value !== null &&
  Number.isFinite(fact.value) &&
  fact.value >= 0;
export function profileCapacity(data: CreditExperience): CreditValue {
  const balance = data.metrics.revolvingBalance,
    limit = data.metrics.revolvingLimit;
  // Summary coverage is unspecified today; matching known coverage is needed for capacity.
  if (
    !usable(balance) ||
    !usable(limit) ||
    balance.quality !== 'KNOWN' ||
    limit.quality !== 'KNOWN' ||
    !balance.basis ||
    balance.basis !== limit.basis
  )
    return unknownValue('Available revolving capacity');
  return {
    value: Math.max(0, limit.value! - balance.value!),
    quality: 'KNOWN',
    definition: 'Available revolving capacity',
    basis: balance.basis,
  };
}
export function eligibleUtilization(data: CreditExperience) {
  const revolving = data.accounts?.filter((a) => a.type?.toLowerCase() === 'revolving') ?? [];
  const eligible = revolving.filter(
    (a) => usable(a.balance) && usable(a.limit) && a.limit.value! > 0,
  );
  return {
    rows: eligible
      .map((a) => ({ account: a, percent: (a.balance.value! / a.limit.value!) * 100 }))
      .sort((a, b) => b.percent - a.percent),
    excluded: revolving.length - eligible.length,
  };
}
export function ProfileUtilization({ data }: { data: CreditExperience }) {
  const fact = data.metrics.aggregateUtilization ?? unknownValue('Published aggregate utilization');
  const valid = usable(fact);
  const { rows, excluded } = eligibleUtilization(data);
  return (
    <Box
      component="section"
      id="utilization"
      sx={{ p: { xs: 2.5, md: 4 }, borderBlock: 1, borderColor: 'divider', scrollMarginTop: 100 }}
    >
      <Typography
        id="profile-heading-utilization"
        tabIndex={-1}
        variant="h4"
        component="h3"
        sx={{ scrollMarginTop: 100 }}
      >
        Revolving utilization & capacity
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Reported balances and limits, with the calculation basis kept in view.
      </Typography>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        sx={{ gap: 3, alignItems: { md: 'center' }, my: 3 }}
      >
        {valid ? (
          <Box
            role="img"
            aria-label={`Published utilization ${fact.value} percent${fact.value! > 100 ? '; visual capped at 100 percent' : ''}`}
            sx={{
              flexShrink: 0,
              width: 148,
              height: 148,
              borderRadius: '50%',
              p: '10px',
              background: `conic-gradient(from -90deg, #006c60, #23a58f ${Math.min(fact.value!, 100)}%, #dbeae4 ${Math.min(fact.value!, 100)}%)`,
            }}
          >
            <Stack
              sx={{
                borderRadius: '50%',
                height: '100%',
                bgcolor: 'background.paper',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <Typography sx={{ fontSize: 32, fontWeight: 700 }}>
                {fact.value!.toLocaleString()}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Revolving utilization
              </Typography>
            </Stack>
          </Box>
        ) : (
          <Box sx={{ maxWidth: 200 }}>
            <CreditDataValue fact={fact} />
          </Box>
        )}
        <Box
          sx={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' },
            gap: 2,
          }}
        >
          {[
            ['Reported balance', data.metrics.revolvingBalance ?? unknownValue('Balance')],
            ['Reported limits', data.metrics.revolvingLimit ?? unknownValue('Limit')],
            ['Available capacity', profileCapacity(data)],
          ].map(([label, value]) => (
            <Box key={label as string}>
              <Typography variant="caption" color="text.secondary">
                {label as string}
              </Typography>
              <CreditDataValue money fact={value as CreditValue} />
            </Box>
          ))}
        </Box>
      </Stack>
      <Box sx={{ bgcolor: '#edf5f1', p: 2, borderRadius: 1, mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {fact.quality === 'PARTIAL'
            ? 'Published summary · Included accounts and calculation coverage were not supplied. Available capacity requires balances and limits from the same confirmed account set.'
            : (fact.basis ?? 'Calculation coverage was not supplied with this publication.')}
        </Typography>
      </Box>
      <Typography component="h4" sx={{ fontWeight: 700 }}>
        Account utilization
      </Typography>
      {data.accounts === null ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Account-level balances and limits were not supplied. Included and excluded account counts
          are unavailable; individual utilization cannot be calculated.
        </Typography>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {rows.length} eligible revolving accounts · {excluded} excluded because balance or a
            positive limit is unavailable. Highest utilization first.
          </Typography>
          {rows.slice(0, 5).map(({ account, percent }) => (
            <Box key={account.id}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                <Typography sx={{ fontWeight: 600 }}>{account.creditor}</Typography>
                <Typography>
                  {percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
                </Typography>
              </Stack>
              <Box
                role="img"
                aria-label={`${account.creditor}: ${percent.toFixed(1)} percent utilization`}
                sx={{ height: 6, bgcolor: 'divider', borderRadius: 2, my: 1 }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${Math.min(percent, 100)}%`,
                    bgcolor: 'primary.main',
                    borderRadius: 2,
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                ${account.balance.value!.toLocaleString()} balance / $
                {account.limit.value!.toLocaleString()} limit
                {account.balance.quality === 'PARTIAL' || account.limit.quality === 'PARTIAL'
                  ? ' · partial reported data'
                  : ''}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
      <Button component={Link} to="/app/credit-center/report#accounts" sx={{ mt: 2 }}>
        View all report accounts →
      </Button>
    </Box>
  );
}
