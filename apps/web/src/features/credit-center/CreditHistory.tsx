import { useState } from 'react';
import {
  Box,
  Button,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import {
  adaptPublishedProfile,
  comparableScores,
  compareCreditValues,
  type CreditExperience,
} from './data';

export type HistorySnapshot = {
  id: string;
  publishedAt: string;
  projection: { profile?: Record<string, unknown> };
  report: null | { reportDate: string | null };
};
/** Missing values remain gaps. No line is drawn over an unavailable observation. */
export function HistoricalMetric({
  points,
  title,
}: {
  points: Array<{ date: string; value: number | null }>;
  title: string;
}) {
  const ordered = [...points].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const dates = ordered.map((p) => Date.parse(p.date)).filter(Number.isFinite);
  const earliest = Math.min(...dates),
    latest = Math.max(...dates);
  const valid = ordered.filter((p) => p.value !== null && Number.isFinite(Date.parse(p.date)));
  const max = Math.max(1, ...valid.map((p) => p.value!));
  const min = Math.min(0, ...valid.map((p) => p.value!));
  const x = (i: number) =>
    40 + ((Date.parse(ordered[i]!.date) - earliest) / Math.max(1, latest - earliest)) * 520;
  const y = (v: number) => 160 - ((v - min) / (max - min)) * 120;
  return (
    <Box component="section">
      <Typography variant="h3" component="h2">
        {title}
      </Typography>
      {valid.length < 2 ? (
        <Typography color="text.secondary" sx={{ my: 2 }}>
          At least two comparable observations are needed to show a trend.
        </Typography>
      ) : (
        <Box
          component="svg"
          viewBox="0 0 600 200"
          role="img"
          aria-label={title + '; exact values are listed below'}
          sx={{ width: '100%', maxHeight: 240, mt: 2 }}
        >
          <path d="M40 20V160H560" fill="none" stroke="currentColor" opacity=".35" />
          {ordered.map((p, i) =>
            p.value === null || !Number.isFinite(Date.parse(p.date)) ? null : (
              <g key={i}>
                {i > 0 &&
                  ordered[i - 1]!.value !== null &&
                  Number.isFinite(Date.parse(ordered[i - 1]!.date)) && (
                    <line
                      x1={x(i - 1)}
                      y1={y(ordered[i - 1]!.value!)}
                      x2={x(i)}
                      y2={y(p.value)}
                      stroke="#66d8bd"
                      strokeWidth="3"
                    />
                  )}
                <circle cx={x(i)} cy={y(p.value)} r="5" fill="#66d8bd" />
              </g>
            ),
          )}
          <text x="40" y="190" fill="currentColor" fontSize="12">
            {valid[0]?.date.slice(0, 10)}
          </text>
          <text x="560" y="190" textAnchor="end" fill="currentColor" fontSize="12">
            {valid.at(-1)?.date.slice(0, 10)}
          </text>
        </Box>
      )}
      <Table size="small" aria-label={title + ' values'}>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Published value</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {points.map((p, i) => (
            <TableRow key={i}>
              <TableCell>{p.date}</TableCell>
              <TableCell>{p.value ?? 'Not available'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
export function CreditHistory({
  snapshots,
  experiences,
}: {
  snapshots: HistorySnapshot[];
  experiences?: CreditExperience[];
}) {
  const [bureau, setBureau] = useState('Experian'),
    [metric, setMetric] = useState('aggregateUtilization'),
    [model, setModel] = useState('');
  const [from, setFrom] = useState(snapshots.at(-1)?.id ?? ''),
    [to, setTo] = useState(snapshots[0]?.id ?? '');
  const rows = snapshots.map((s, i) => ({
    ...s,
    data:
      experiences?.[i] ??
      adaptPublishedProfile(s.projection.profile ?? {}, s.report?.reportDate ?? null),
  }));
  const a = rows.find((r) => r.id === from),
    b = rows.find((r) => r.id === to);
  const series = rows.map((r) => ({
    date: r.report?.reportDate ?? null,
    score: r.data.scores.find((s) => s.bureau === bureau),
  }));
  const models = [...new Set(series.flatMap((s) => (s.score?.model ? [s.score.model] : [])))];
  const selectedModel = models.includes(model) ? model : (models[0] ?? '');
  const reference = series.find((s) => s.score?.model === selectedModel)?.score;
  const metricReference = rows.find((r) => r.data.metrics[metric]?.quality === 'KNOWN')?.data
    .metrics[metric];
  const scorePoints = series
    .map((s) => ({
      date: s.date ?? 'Report date unavailable',
      value: reference && s.score && comparableScores(reference, s.score) ? s.score.value : null,
    }))
    .reverse();
  const label = (
    {
      aggregateUtilization: 'Utilization',
      revolvingLimit: 'Known revolving limits',
      revolvingBalance: 'Reported balances',
      recentInquiries: 'Hard inquiries',
    } as Record<string, string>
  )[metric]!;
  return (
    <Stack spacing={4}>
      <Box>
        <Stack
          direction="row"
          sx={{
            gap: 2,
            mb: 2,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="h2">Credit score over time</Typography>
          <TextField
            select
            size="small"
            label="Bureau"
            value={bureau}
            onChange={(e) => setBureau(e.target.value)}
          >
            {['Experian', 'Equifax', 'TransUnion'].map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        {models.length > 0 && (
          <TextField
            select
            size="small"
            label="Scoring model"
            value={selectedModel}
            onChange={(e) => setModel(e.target.value)}
            sx={{ minWidth: 220, mb: 2 }}
          >
            {models.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        )}
        <Typography color="text.secondary">
          Only scores with the same bureau, model and supplied range can be compared.
        </Typography>
        {!reference ? (
          <Typography sx={{ my: 2 }}>
            Scoring models were not supplied with these publications. Scores remain visible in each
            saved snapshot; no change or trend is inferred.
          </Typography>
        ) : (
          <HistoricalMetric title={reference.model! + ' · ' + bureau} points={scorePoints} />
        )}
      </Box>
      <Box>
        <TextField
          select
          label="Credit trend"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          sx={{ minWidth: 240, mb: 2 }}
        >
          {Object.entries({
            aggregateUtilization: 'Utilization',
            revolvingLimit: 'Known revolving limits',
            revolvingBalance: 'Reported balances',
            recentInquiries: 'Hard inquiries',
          }).map(([key, name]) => (
            <MenuItem key={key} value={key}>
              {name}
            </MenuItem>
          ))}
        </TextField>
        <HistoricalMetric
          title={label}
          points={rows
            .map((r) => ({
              date: r.report?.reportDate ?? 'Report date unavailable',
              value:
                r.report?.reportDate &&
                metricReference &&
                r.data.metrics[metric] &&
                compareCreditValues(metricReference, r.data.metrics[metric]!) !== null
                  ? r.data.metrics[metric]!.value
                  : null,
            }))
            .reverse()}
        />
        <Typography variant="caption" color="text.secondary">
          A consistent calculation basis and report date are required. Partial summaries do not
          establish a comparable series.
        </Typography>
      </Box>
      <Box>
        <Typography variant="h2">Compare reports</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ my: 2 }}>
          {(
            [
              ['From', from, setFrom],
              ['To', to, setTo],
            ] as const
          ).map(([name, value, setter]) => (
            <TextField
              key={name}
              select
              label={name}
              value={value}
              onChange={(e) => setter(e.target.value)}
              sx={{ flex: 1 }}
            >
              {rows.map((r, i) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.report?.reportDate ?? 'Report date unavailable'} · Publication{' '}
                  {rows.length - i}
                </MenuItem>
              ))}
            </TextField>
          ))}
        </Stack>
        {a && b && (
          <Stack spacing={2}>
            {a.data.scores.map((previous) => {
              const next = b.data.scores.find((score) => score.bureau === previous.bureau);
              const delta =
                next && a.id !== b.id && comparableScores(previous, next)
                  ? next.value! - previous.value!
                  : null;
              return (
                <Box key={previous.bureau} sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
                  <Typography>{previous.bureau} score</Typography>
                  <Typography>
                    From: {previous.value ?? 'Not available'} ·{' '}
                    {previous.model ?? 'Model not supplied'}
                  </Typography>
                  <Typography>
                    To: {next?.value ?? 'Not available'} · {next?.model ?? 'Model not supplied'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {delta === null
                      ? 'No score delta: different reports with a compatible bureau, model, range and report date are required.'
                      : 'Observed change: ' + (delta > 0 ? '+' : '') + delta}
                  </Typography>
                </Box>
              );
            })}
            {[
              'aggregateUtilization',
              'revolvingBalance',
              'revolvingLimit',
              'openAccounts',
              'recentInquiries',
            ].map((key) => {
              const av = a.data.metrics[key],
                bv = b.data.metrics[key];
              const delta = av && bv && a.id !== b.id ? compareCreditValues(av, bv) : null;
              return (
                <Box
                  key={key}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr' },
                    gap: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                    pb: 2,
                  }}
                >
                  <Typography>{av?.definition ?? key}</Typography>
                  <Typography>From: {av?.value ?? 'Not available'}</Typography>
                  <Typography>To: {bv?.value ?? 'Not available'}</Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ gridColumn: '1 / -1' }}
                  >
                    {delta === null
                      ? 'No delta: select different reports with comparable definitions and complete calculation coverage.'
                      : `Observed change: ${delta > 0 ? '+' : ''}${delta}`}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
      <Box>
        <Typography variant="h2">What changed between reports?</Typography>
        <Typography color="text.secondary" sx={{ my: 2 }}>
          Saved publications below preserve what was known then. Account-level changes and their
          dates were not supplied. A publication or application event does not establish what caused
          a score change.
        </Typography>
        <Button component={Link} to="/app/credit-center/analysis">
          Read current Analysis
        </Button>
        <Button component={Link} to="/app/credit-center/plan">
          Continue your Plan
        </Button>
      </Box>
    </Stack>
  );
}
