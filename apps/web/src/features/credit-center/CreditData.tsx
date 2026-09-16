import { formatReportDate } from './data';
import { useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { Link } from 'react-router-dom';
import { PublishedUtilizationRing } from '../../components/common/PublishedCreditVisuals';
import { designTokens } from '../../theme';
import { type CreditExperience, type CreditValue, type ScoreFact, unknownValue } from './data';

export function CreditDataValue({
  fact,
  money = false,
  suffix = '',
}: {
  fact: CreditValue;
  money?: boolean;
  suffix?: string;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography
        sx={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: fact.value === null ? 15 : 24,
          fontWeight: 600,
        }}
      >
        {fact.quality === 'NOT_APPLICABLE'
          ? 'Not applicable'
          : fact.value === null || fact.quality === 'UNKNOWN'
            ? 'Not available in this report'
            : (money ? '$' : '') + fact.value.toLocaleString() + suffix}
      </Typography>
      {fact.quality === 'PARTIAL' && (
        <Box
          component="details"
          sx={{
            color: 'text.secondary',
            fontSize: 12,
            '& summary': {
              cursor: 'pointer',
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
            },
          }}
        >
          <summary>Partial coverage · Details</summary>
          <Typography variant="caption">Based on available data. {fact.basis}</Typography>
        </Box>
      )}
    </Stack>
  );
}

export function BureauScoreGallery({ scores }: { scores: ScoreFact[] }) {
  const [index, setIndex] = useState(0);
  const start = useRef<number | null>(null);
  const score = scores[Math.min(index, Math.max(0, scores.length - 1))];
  const move = (by: number) => setIndex((i) => Math.max(0, Math.min(scores.length - 1, i + by)));
  const suppliedRange =
    score?.range &&
    score.value !== null &&
    score.value >= score.range[0] &&
    score.value <= score.range[1] &&
    score.range[1] > score.range[0]
      ? score.range
      : null;
  return (
    <Box
      component="section"
      aria-label="Bureau scores"
      onTouchStart={(e) => {
        start.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (start.current !== null) {
          const delta = (e.changedTouches[0]?.clientX ?? start.current) - start.current;
          if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1);
        }
        start.current = null;
      }}
      sx={{
        p: { xs: 2.5, md: 4 },
        borderRadius: 3,
        background: designTokens.gradient.data,
        minWidth: 0,
      }}
    >
      <Typography component="h2" variant="h4">
        Scores in your report
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, my: 2 }}>
        {scores.map((s, i) => (
          <Button
            key={s.bureau}
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
            sx={{
              borderBottom: 2,
              borderColor: i === index ? 'primary.main' : 'transparent',
              borderRadius: 0,
            }}
          >
            {s.bureau}
          </Button>
        ))}
      </Stack>
      <Box aria-live="polite" aria-atomic="true">
        <Typography variant="overline">{score?.bureau ?? 'Credit score'}</Typography>
        <Typography
          sx={{
            fontSize: score?.value != null ? { xs: 76, md: 96 } : 24,
            fontWeight: 500,
            letterSpacing: '-.05em',
            lineHeight: 1.15,
            fontVariantNumeric: 'tabular-nums',
            my: 2,
          }}
        >
          {score?.value ?? 'Not available in this report'}
        </Typography>
        <Typography color="text.secondary">
          {score?.model ?? 'Scoring model not supplied'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {score?.date
            ? 'Report dated ' + formatReportDate(score.date)
            : 'Report date not supplied'}
        </Typography>
        {suppliedRange && score && score.value !== null && (
          <Box
            role="img"
            aria-label={`${score.bureau} score ${score.value}, supplied range ${suppliedRange[0]} to ${suppliedRange[1]}`}
            sx={{ mt: 3 }}
          >
            <Box sx={{ height: 8, position: 'relative', bgcolor: 'divider', borderRadius: 4 }}>
              <Box
                sx={{
                  position: 'absolute',
                  left: `${((score!.value! - suppliedRange[0]) / (suppliedRange[1] - suppliedRange[0])) * 100}%`,
                  top: -5,
                  width: 4,
                  height: 18,
                  bgcolor: 'primary.main',
                }}
              />
            </Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption">{suppliedRange[0]}</Typography>
              <Typography variant="caption">{suppliedRange[1]}</Typography>
            </Stack>
          </Box>
        )}
        {!suppliedRange && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            A rating scale is unavailable because this publication does not include the score’s
            range.
          </Typography>
        )}
      </Box>
      {!!score?.factors.length && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreRounded />}>
            Factors included with your score
          </AccordionSummary>
          <AccordionDetails>
            {score.factors.map((f, i) => (
              <Typography key={i}>{f}</Typography>
            ))}
          </AccordionDetails>
        </Accordion>
      )}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
        <Button aria-label="Previous bureau" disabled={index === 0} onClick={() => move(-1)}>
          <ChevronLeftRounded />
        </Button>
        <Typography variant="caption">
          {scores.length ? index + 1 : 0} of {scores.length}
        </Typography>
        <Button
          aria-label="Next bureau"
          disabled={index >= scores.length - 1}
          onClick={() => move(1)}
        >
          <ChevronRightRounded />
        </Button>
      </Stack>
      <Button component={Link} to="/app/credit-center/history">
        See score history
      </Button>
    </Box>
  );
}
export function UtilizationCapacity({ data }: { data: CreditExperience }) {
  const fact = data.metrics.aggregateUtilization ?? unknownValue('Utilization');
  return (
    <Box
      component="section"
      id="utilization"
      sx={{ p: { xs: 2.5, md: 4 }, borderLeft: { lg: 1 }, borderColor: 'divider' }}
    >
      <Typography variant="h4" component="h2">
        Utilization & capacity
      </Typography>
      {fact.quality === 'UNKNOWN' || fact.quality === 'NOT_APPLICABLE' ? (
        <Box sx={{ my: 3 }}>
          <CreditDataValue fact={fact} />
        </Box>
      ) : (
        <PublishedUtilizationRing value={fact.value} />
      )}
      {fact.quality === 'PARTIAL' && (
        <Typography variant="caption" color="text.secondary">
          Published utilization; account coverage not supplied. This is not a calculation from a
          complete account list.
        </Typography>
      )}
      <Stack direction="row" spacing={3} sx={{ my: 2 }}>
        {(
          [
            ['revolvingBalance', 'Reported balance'],
            ['revolvingLimit', 'Known limits'],
          ] as const
        ).map(([key, title]) => (
          <Box key={key} sx={{ flex: 1 }}>
            <Typography variant="caption">{title}</Typography>
            <CreditDataValue money fact={data.metrics[key] ?? unknownValue(title)} />
          </Box>
        ))}
      </Stack>
      <Button component={Link} to="/app/credit-center/profile#utilization">
        Explore utilization
      </Button>
    </Box>
  );
}
export function CreditMetricStrip({ data }: { data: CreditExperience }) {
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,minmax(0,1fr))' },
        gap: 3,
        m: 0,
        py: 3,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {(
        [
          ['openAccounts', 'Open accounts', 'accounts'],
          ['revolvingLimit', 'Revolving limits', 'utilization'],
          ['revolvingBalance', 'Reported balances', 'utilization'],
          ['recentInquiries', 'Reported inquiries', 'inquiries'],
        ] as const
      ).map(([key, title, section]) => (
        <Box key={key}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Box component="dd" sx={{ m: 0, mt: 1 }}>
            <CreditDataValue
              fact={data.metrics[key] ?? unknownValue(title)}
              money={key.startsWith('revolving')}
            />
          </Box>
          <Button size="small" component={Link} to={'/app/credit-center/profile#' + section}>
            Explore {title.toLowerCase()}
          </Button>
        </Box>
      ))}
    </Box>
  );
}
