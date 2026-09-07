import {
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
  type SxProps,
  type Theme,
} from '@mui/material';
import { useEffect, type ReactNode } from 'react';
import { designTokens } from '../../theme';
import { freshnessLabel, humanState, type ProductRole } from './contentSystem';

export type ScreenArchetype =
  | 'guided-decision'
  | 'financial-dashboard'
  | 'lifecycle-timeline'
  | 'research-gallery'
  | 'client-workbench'
  | 'live-command'
  | 'operations-grid'
  | 'configuration-studio'
  | 'observability-cockpit'
  | 'conversation-workspace';

const roleAccent: Record<ProductRole, string> = {
  client: designTokens.color.cyan,
  consultant: designTokens.color.teal,
  admin: designTokens.color.violet,
};

export function ArchetypeCanvas({
  archetype,
  role,
  children,
  sx,
}: {
  archetype: ScreenArchetype;
  role: ProductRole;
  children: ReactNode;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      data-archetype={archetype}
      data-role={role}
      sx={[
        {
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: { xs: 3, md: 4 },
          p: { xs: 2, md: role === 'client' ? 3.5 : 2.5 },
          background: `radial-gradient(circle at 92% 8%, ${roleAccent[role]}22, transparent 34%), linear-gradient(145deg, ${designTokens.color.surfaceElevated}, ${designTokens.color.surfaceOperational})`,
          boxShadow: designTokens.shadow.card,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

export function MetricHero({
  label,
  value,
  unit,
  explanation,
  source,
  asOf,
}: {
  label: string;
  value: string | number;
  unit?: string;
  explanation: string;
  source?: string;
  asOf?: string;
}) {
  const accessible = `${label}: ${value}${unit ? ` ${unit}` : ''}. ${explanation}${source ? ` Source: ${source}.` : ''}`;
  return (
    <Box role="img" aria-label={accessible} sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="primary">{label}</Typography>
      <Typography sx={{ fontSize: 'clamp(2.25rem, 7vw, 4.75rem)', fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.06em' }}>
        {value}{unit && <Typography component="span" sx={{ ml: 1, fontSize: '0.35em', color: 'text.secondary' }}>{unit}</Typography>}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>{explanation}</Typography>
      {(source || asOf) && <Typography variant="caption" color="text.secondary">{[source && `Source: ${source}`, asOf && `As of ${asOf}`].filter(Boolean).join(' · ')}</Typography>}
    </Box>
  );
}

export function UtilizationGauge({ value, source, asOf }: { value: number; source: string; asOf?: string | undefined }) {
  const bounded = Math.min(100, Math.max(0, value));
  const tone = bounded < 30 ? designTokens.color.teal : bounded < 60 ? designTokens.color.amber : designTokens.color.coral;
  return (
    <Box role="img" aria-label={`Credit utilization ${bounded.toFixed(1)} percent. Source: ${source}.`}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography variant="h3">Utilization</Typography>
        <Typography sx={{ fontSize: '2rem', fontWeight: 800 }}>{bounded.toFixed(1)}%</Typography>
      </Stack>
      <Box sx={{ mt: 1.5, height: 14, borderRadius: 999, bgcolor: 'rgba(148,163,184,.18)', overflow: 'hidden' }}>
        <Box sx={{ width: `${bounded}%`, height: '100%', bgcolor: tone, borderRadius: 'inherit', transition: `width ${designTokens.motion.standard} ${designTokens.motion.easing}` }} />
      </Box>
      <Typography variant="caption" color="text.secondary">Source: {source}{asOf ? ` · As of ${asOf}` : ''}</Typography>
    </Box>
  );
}

export function ScoreBand({ value, min = 300, max = 850, source, asOf }: { value: number; min?: number; max?: number; source: string; asOf?: string }) {
  const position = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <Box role="img" aria-label={`Credit score ${value} on a scale from ${min} to ${max}. Source: ${source}.`}>
      <Typography variant="h3">Credit score</Typography>
      <Box sx={{ position: 'relative', mt: 2, height: 16, borderRadius: 999, background: 'linear-gradient(90deg, #ef6b73, #f6b84b, #36d3ae)' }}>
        <Box sx={{ position: 'absolute', left: `${position}%`, top: -6, width: 4, height: 28, bgcolor: 'text.primary', borderRadius: 2, boxShadow: '0 0 0 3px rgba(7,11,24,.7)' }} />
      </Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.75 }}><Typography variant="caption">{min}</Typography><Typography sx={{ fontWeight: 800 }}>{value}</Typography><Typography variant="caption">{max}</Typography></Stack>
      <Typography variant="caption" color="text.secondary">Source: {source}{asOf ? ` · As of ${asOf}` : ''}</Typography>
    </Box>
  );
}

export type LifecycleRailItem = { key: string; label: string; state: 'COMPLETED' | 'ACTIVE' | 'AVAILABLE' | 'LOCKED'; detail?: string };
export function LifecycleRail({ title, items }: { title: string; items: LifecycleRailItem[] }) {
  return (
    <Box aria-label={title}>
      <Typography variant="h3">{title}</Typography>
      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${items.length}, minmax(0, 1fr))` }, gap: 1 }}>
        {items.map((item, index) => (
          <Box component="li" key={item.key} aria-current={item.state === 'ACTIVE' ? 'step' : undefined} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: item.state === 'ACTIVE' ? 'primary.main' : 'divider', bgcolor: item.state === 'ACTIVE' ? 'rgba(66,211,242,.08)' : 'rgba(7,11,24,.35)', opacity: item.state === 'LOCKED' ? 0.68 : 1 }}>
            <Typography variant="caption" color="text.secondary">Step {index + 1} · {humanState(item.state)}</Typography>
            <Typography sx={{ fontWeight: 750 }}>{item.label}</Typography>
            {item.detail && <Typography variant="caption" color="text.secondary">{item.detail}</Typography>}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function ProgressArc({ value, label }: { value: number; label: string }) {
  const bounded = Math.min(100, Math.max(0, value));
  return (
    <Box role="img" aria-label={`${label}: ${Math.round(bounded)} percent complete`} sx={{ width: 132, aspectRatio: '1', borderRadius: '50%', display: 'grid', placeItems: 'center', background: `conic-gradient(${designTokens.color.cyan} ${bounded}%, rgba(148,163,184,.18) 0)`, position: 'relative', '&::after': { content: '""', position: 'absolute', inset: 12, borderRadius: '50%', bgcolor: designTokens.color.surfaceElevated } }}>
      <Stack sx={{ position: 'relative', zIndex: 1, alignItems: 'center' }}><Typography sx={{ fontSize: '1.6rem', fontWeight: 800 }}>{Math.round(bounded)}%</Typography><Typography variant="caption">{label}</Typography></Stack>
    </Box>
  );
}

export function CurrentStateSummary({ state, meaning, owner, asOf, action }: { state: string; meaning: string; owner: string; asOf?: string | undefined; action?: ReactNode }) {
  return (
    <ArchetypeCanvas archetype="guided-decision" role="client">
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 1 }}>
          <Box><Typography variant="overline" color="primary">Current focus</Typography><Typography variant="h2">{state}</Typography></Box>
          <Chip label={`Owner: ${owner}`} variant="outlined" sx={{ alignSelf: 'flex-start' }} />
        </Stack>
        <Typography color="text.secondary" sx={{ maxWidth: 720 }}>{meaning}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
          <FreshnessIndicator state="confirmed" at={asOf} />
          {action}
        </Stack>
      </Stack>
    </ArchetypeCanvas>
  );
}

export function PagePurpose({ purpose, whyNow }: { purpose: string; whyNow?: string }) {
  return <Stack spacing={0.5}><Typography color="text.secondary">Use this page to {purpose}.</Typography>{whyNow && <Typography sx={{ fontWeight: 700 }}>Why this matters now: {whyNow}</Typography>}</Stack>;
}

export function WaitingState({ prerequisite, owner, unavailable, userMustAct }: { prerequisite: string; owner: string; unavailable: string; userMustAct: boolean }) {
  return <Alert severity={userMustAct ? 'warning' : 'info'}><Typography sx={{ fontWeight: 800 }}>{prerequisite}</Typography><Typography>{owner} owns the next step. {unavailable} remains unavailable until it is complete. {userMustAct ? 'You need to act now.' : 'You do not need to act now.'}</Typography></Alert>;
}

export function ProductiveEmptyState({ title, reason, owner, action }: { title: string; reason: string; owner: string; action?: ReactNode }) {
  return <Box sx={{ py: 5, px: 2, textAlign: 'center' }}><Typography variant="h3">{title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{reason} {owner} creates the next record.</Typography>{action && <Box sx={{ mt: 2 }}>{action}</Box>}</Box>;
}

export function SuccessState({ action, change, next }: { action: string; change: string; next: string }) {
  return <Alert severity="success"><Typography sx={{ fontWeight: 800 }}>{action}</Typography><Typography>{change}</Typography><Typography variant="body2">Next: {next}</Typography></Alert>;
}

export function DraftPublicationStatus({ state, version, owner }: { state: 'draft' | 'advisory' | 'published' | 'reported' | 'system-calculated'; version?: number; owner: string }) {
  const labels = { draft: 'Draft — not client-visible', advisory: 'Advisory — human review required', published: 'Published', reported: 'Reported by source', 'system-calculated': 'System-calculated' };
  return <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}><Chip label={labels[state]} color={state === 'published' ? 'success' : state === 'draft' ? 'warning' : 'info'} variant="outlined" />{version && <Chip label={`Version ${version}`} variant="outlined" />}<Typography variant="caption" color="text.secondary">Owner: {owner}</Typography></Stack>;
}

export function ProvenanceDetails({ source, asOf, method, children }: { source: string; asOf?: string; method?: string; children?: ReactNode }) {
  return <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent', border: '1px solid', borderColor: 'divider', '&::before': { display: 'none' } }}><AccordionSummary><Typography sx={{ fontWeight: 700 }}>Source and calculation details</Typography></AccordionSummary><AccordionDetails><Stack spacing={0.5}><Typography>Source: {source}</Typography>{asOf && <Typography>As of: {asOf}</Typography>}{method && <Typography>Method: {method}</Typography>}{children}</Stack></AccordionDetails></Accordion>;
}

export type FreshnessState = 'live' | 'reconnecting' | 'stale' | 'restored' | 'confirmed';
export function FreshnessIndicator({ state, at }: { state: FreshnessState; at?: string | undefined }) {
  const labels: Record<FreshnessState, string> = { live: 'Live', reconnecting: 'Reconnecting', stale: `Stale${at ? ` · ${freshnessLabel(at)}` : ''}`, restored: 'Restored', confirmed: at ? freshnessLabel(at) : 'Confirmed' };
  return <Box aria-live="polite"><Chip label={labels[state]} color={state === 'stale' ? 'warning' : state === 'reconnecting' ? 'info' : state === 'live' || state === 'restored' ? 'success' : 'default'} variant="outlined" sx={state === 'live' ? { '&::before': { content: '""', width: 7, height: 7, bgcolor: 'success.main', borderRadius: '50%', mr: 1, '@media (prefers-reduced-motion: no-preference)': { animation: 'pulse 1.8s ease-in-out infinite' } }, '@keyframes pulse': { '50%': { opacity: 0.35 } } } : undefined} /></Box>;
}

export function AutosaveStatus({ state, at, onRetry }: { state: 'saving' | 'saved' | 'offline' | 'conflict'; at?: string; onRetry?: () => void }) {
  const copy = { saving: 'Saving draft…', saved: at ? `Saved ${freshnessLabel(at)}` : 'Draft saved', offline: 'Offline — changes are waiting to save', conflict: 'A newer version exists — review before saving' }[state];
  return <Alert severity={state === 'conflict' ? 'warning' : state === 'offline' ? 'info' : 'success'} aria-live="polite" action={onRetry && state !== 'saved' ? <Button onClick={onRetry}>Retry saving draft</Button> : undefined}>{copy} Publishing remains a separate action.</Alert>;
}

export function StickyActionBar({ children, label = 'Page actions' }: { children: ReactNode; label?: string }) {
  return <Box aria-label={label} sx={{ position: 'sticky', bottom: 12, zIndex: 5, p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 999, bgcolor: 'rgba(13,21,40,.94)', backdropFilter: 'blur(16px)', boxShadow: designTokens.shadow.elevated }}><Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>{children}</Stack></Box>;
}

export function ResponsiveContextDrawer({ open, title, onClose, returnFocusRef, children }: { open: boolean; title: string; onClose: () => void; returnFocusRef?: React.RefObject<HTMLElement | null>; children: ReactNode }) {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  useEffect(() => { if (!open) returnFocusRef?.current?.focus(); }, [open, returnFocusRef]);
  return <Drawer open={open} onClose={onClose} anchor={narrow ? 'bottom' : 'right'} slotProps={{ paper: { sx: { width: narrow ? '100%' : 480, maxHeight: narrow ? '88vh' : '100%' } } }}><Stack spacing={2} sx={{ p: 3 }}><Typography variant="h2">{title}</Typography>{children}<Button onClick={onClose}>Close {title}</Button></Stack></Drawer>;
}

export function ComparisonMatrix({ title, columns, rows }: { title: string; columns: string[]; rows: Array<{ label: string; values: ReactNode[] }> }) {
  return <Box sx={{ overflowX: 'auto' }}><table aria-label={title} style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}><caption style={{ textAlign: 'left', fontWeight: 800, fontSize: '1.2rem', paddingBottom: 12 }}>{title}</caption><thead><tr><th scope="col" style={{ textAlign: 'left', padding: 12 }}>Measure</th>{columns.map((column) => <th scope="col" key={column} style={{ textAlign: 'left', padding: 12 }}>{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th scope="row" style={{ textAlign: 'left', padding: 12, borderTop: '1px solid rgba(148,163,184,.16)' }}>{row.label}</th>{row.values.map((value, index) => <td key={index} style={{ padding: 12, borderTop: '1px solid rgba(148,163,184,.16)' }}>{value}</td>)}</tr>)}</tbody></table></Box>;
}

export function EventTimeline({ title, events }: { title: string; events: Array<{ id: string; title: string; at: string; detail?: string }> }) {
  return <Box><Typography variant="h3">{title}</Typography><Stack component="ol" sx={{ listStyle: 'none', pl: 0, mt: 2 }}>{events.map((event) => <Box component="li" key={event.id} sx={{ position: 'relative', pl: 3, pb: 2, borderLeft: '2px solid', borderColor: 'divider', '&::before': { content: '""', position: 'absolute', left: -6, top: 4, width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main' } }}><Typography sx={{ fontWeight: 750 }}>{event.title}</Typography><Typography variant="caption" color="text.secondary">{formatProductTime(event.at)}</Typography>{event.detail && <Typography color="text.secondary">{event.detail}</Typography>}</Box>)}</Stack></Box>;
}

const formatProductTime = (at: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at));

export function Sparkline({ title, values, unit, source }: { title: string; values: number[]; unit: string; source: string }) {
  const max = Math.max(...values); const min = Math.min(...values); const span = max - min || 1;
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${38 - ((value - min) / span) * 34}`).join(' ');
  return <Box role="img" aria-label={`${title}: ${values.join(', ')} ${unit}. Source: ${source}.`}><Typography variant="h3">{title}</Typography><svg viewBox="0 0 100 42" width="100%" height="92" aria-hidden="true" preserveAspectRatio="none"><polyline points={points} fill="none" stroke={designTokens.color.cyan} strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg><Typography variant="caption" color="text.secondary">Text values: {values.join(', ')} {unit} · Source: {source}</Typography></Box>;
}

export function DependencyMap({ title, items }: { title: string; items: Array<{ label: string; ready: boolean }> }) {
  return <Box><Typography variant="h3">{title}</Typography><Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1, mt: 1.5, alignItems: { sm: 'center' } }}>{items.map((item, index) => <Stack key={item.label} direction="row" sx={{ gap: 1, alignItems: 'center' }}><Chip label={`${item.label}: ${item.ready ? 'Ready' : 'Required'}`} color={item.ready ? 'success' : 'warning'} variant="outlined" />{index < items.length - 1 && <Typography aria-hidden="true">→</Typography>}</Stack>)}</Stack></Box>;
}

export function MoneyFlow({ title, entries, source }: { title: string; entries: Array<{ label: string; amount: string }>; source: string }) {
  return <Box role="group" aria-label={title}><Typography variant="h3">{title}</Typography><Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1, mt: 1.5 }}>{entries.map((entry, index) => <Stack key={entry.label} direction="row" sx={{ alignItems: 'center', gap: 1 }}><Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}><Typography variant="caption">{entry.label}</Typography><Typography sx={{ fontWeight: 800 }}>{entry.amount}</Typography></Box>{index < entries.length - 1 && <Typography aria-hidden="true">→</Typography>}</Stack>)}</Stack><Typography variant="caption" color="text.secondary">Source: {source}</Typography></Box>;
}
