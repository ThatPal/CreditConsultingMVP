import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Alert, Box, Button, ButtonBase, Stack, Tooltip, Typography } from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import CreditScoreRounded from '@mui/icons-material/CreditScoreRounded';
import RouteRounded from '@mui/icons-material/RouteRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import SpeedOutlined from '@mui/icons-material/SpeedOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import { apiRequest } from '../../auth/api';
import type { ClientPlanResponse } from '../../pages/PlanPages';
import { creditWorkspaceKeys, creditWorkspaceRefetchInterval } from '../../queries/creditWorkspace';
import { portalSurfaces } from '../../theme/portalSurfaces';
import { designTokens } from '../../theme';
import {
  buildOverviewModel,
  type OverviewModel,
  type PublishedOverviewRead,
} from './overviewModel';
import { creditCenterAreas, creditCenterPath } from './CreditCenterNavigation';
import { formatReportDate, type CreditExperience } from './data';
import { planStepUrl } from '../plans/PlanRoadmap';
import { presentStatus } from '../../components/common/statusVocabulary';

function Destination({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button
      component={Link}
      to={to}
      size="small"
      endIcon={<ArrowForwardRounded sx={{ fontSize: 16 }} />}
      sx={{ px: 1, fontSize: 12, flexShrink: 0 }}
    >
      {children}
    </Button>
  );
}
function FindingSymbol({ severity }: { severity: string }) {
  // Presentation follows the published finding, never a classification inferred from its text.
  const presentation =
    severity === 'POSITIVE'
      ? { Icon: CheckCircleOutlineRounded, color: 'primary.main', label: 'Positive finding' }
      : severity === 'CAUTION'
        ? { Icon: WarningAmberRounded, color: 'warning.main', label: 'Caution finding' }
        : severity === 'CRITICAL'
          ? { Icon: ErrorOutlineRounded, color: 'error.main', label: 'Critical finding' }
          : { Icon: InfoOutlined, color: 'info.main', label: 'Informational finding' };
  return (
    <Tooltip title={presentation.label}>
      <Box
        role="img"
        aria-label={presentation.label}
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '1px solid',
          borderColor: 'currentColor',
          color: presentation.color,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <presentation.Icon sx={{ fontSize: 20 }} />
      </Box>
    </Tooltip>
  );
}
function Panel({
  title,
  eyebrow,
  action,
  children,
  assessment = false,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  assessment?: boolean;
}) {
  return (
    <Box
      component="section"
      sx={{
        p: { xs: 2, lg: 3 },
        minWidth: 0,
        border: 1,
        borderColor: assessment ? '#b9d9cf' : portalSurfaces.border,
        borderRadius: '14px',
        background: assessment
          ? 'radial-gradient(ellipse at 100% 0%, rgba(102,216,189,.14), transparent 65%), linear-gradient(145deg, #f4f8f7, #e8f2ef)'
          : portalSurfaces.panel,
        color: assessment ? '#173e35' : 'text.primary',
        boxShadow: '0 10px 30px rgba(0,0,0,.08)',
        ...(assessment
          ? {
              '& .MuiTypography-root': { color: 'inherit' },
              '& .MuiStack-root': { color: 'inherit' },
              '& .MuiTypography-colorTextSecondary': { color: '#48675e' },
              '& .MuiButton-root': { color: '#075f55' },
              '& .MuiSvgIcon-root': { color: '#087f65' },
              '& [tabindex="0"]': { color: '#48675e' },
            }
          : {}),
      }}
    >
      <Stack
        direction="row"
        sx={{
          gap: 1,
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: { xs: 2, lg: 2.5 },
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Typography
            component="h2"
            variant="h4"
            sx={{ fontSize: { xs: 16, lg: 17 }, fontWeight: 650, letterSpacing: '-.02em' }}
          >
            {title}
          </Typography>
          {eyebrow && (
            <Tooltip title={eyebrow}>
              <Box
                component="span"
                tabIndex={0}
                aria-label={eyebrow}
                sx={{ display: 'inline-flex', color: 'text.secondary' }}
              >
                <InfoOutlined sx={{ fontSize: 14 }} />
              </Box>
            </Tooltip>
          )}
        </Stack>
        {action}
      </Stack>
      {children}
    </Box>
  );
}
function Snapshot({ data }: { data: CreditExperience }) {
  const [selected, setSelected] = useState(0);
  const [touch, setTouch] = useState<number | null>(null);
  const metrics = [
    ['aggregateUtilization', 'Utilization', '%', SpeedOutlined],
    ['openAccounts', 'Open accounts', '', CreditCardOutlined],
    ['recentInquiries', 'Reported inquiries', '', SearchOutlined],
    ['revolvingLimit', 'Revolving limits', '$', AccountBalanceWalletOutlined],
    ['revolvingBalance', 'Reported balances', '$', PaymentsOutlined],
  ] as const;
  return (
    <Panel
      title="Credit Snapshot"
      eyebrow="Published facts"
      action={<Destination to="/app/credit-center/profile">View Profile</Destination>}
    >
      <Box
        sx={{
          borderRadius: '12px',
          pt: { xs: 0, lg: 1 },
          pb: { xs: 0, lg: 1 },
          background: {
            lg: 'radial-gradient(ellipse at 50% 42%, rgba(102,216,189,.07), transparent 72%)',
          },
        }}
        onTouchStart={(e) => setTouch(e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touch !== null) {
            const delta = (e.changedTouches[0]?.clientX ?? touch) - touch;
            if (Math.abs(delta) > 45)
              setSelected((i) =>
                Math.max(0, Math.min(data.scores.length - 1, i + (delta < 0 ? 1 : -1))),
              );
          }
          setTouch(null);
        }}
      >
        <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 0.5, mb: 1 }}>
          {data.scores.map((s, i) => (
            <Button
              key={s.bureau}
              size="small"
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
              sx={{
                px: 1,
                minWidth: 0,
                flex: 1,
                fontSize: 12,
                color: i === selected ? 'primary.main' : 'text.secondary',
                borderBottom: 2,
                borderColor: i === selected ? 'primary.main' : 'transparent',
                borderRadius: 0,
              }}
            >
              {s.bureau}
            </Button>
          ))}
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3,minmax(0,1fr))' },
            gap: 1.5,
          }}
        >
          {data.scores.map((s, i) => {
            const range =
              s.range &&
              s.value !== null &&
              s.range[1] > s.range[0] &&
              s.value >= s.range[0] &&
              s.value <= s.range[1]
                ? s.range
                : null;
            return (
              <Box
                key={s.bureau}
                sx={{
                  display: { xs: i === selected ? 'block' : 'none', md: 'block' },
                  textAlign: 'center',
                  py: 1,
                }}
              >
                <Box
                  sx={{
                    width: { xs: 140, md: 112, xl: 132 },
                    maxWidth: '100%',
                    mx: 'auto',
                    position: 'relative',
                    mb: 1,
                  }}
                >
                  <svg
                    viewBox="0 0 120 96"
                    role="img"
                    aria-label={
                      range
                        ? `${s.bureau} score ${s.value}, range ${range[0]} to ${range[1]}`
                        : `${s.bureau}: score range unavailable`
                    }
                    style={{ width: '100%', display: 'block' }}
                  >
                    <path
                      d="M 15 78 A 50 50 0 1 1 105 78"
                      fill="none"
                      stroke="rgba(126,176,187,.2)"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    {range && (
                      <path
                        d="M 15 78 A 50 50 0 1 1 105 78"
                        fill="none"
                        stroke={designTokens.accent.main}
                        strokeWidth="5"
                        strokeLinecap="round"
                        pathLength="100"
                        strokeDasharray={`${((s.value! - range[0]) / (range[1] - range[0])) * 100} 100`}
                      />
                    )}
                  </svg>
                  <Typography
                    sx={{
                      position: 'absolute',
                      top: '34%',
                      width: '100%',
                      fontSize: s.value === null ? 22 : { xs: 38, md: 32, xl: 36 },
                      fontWeight: 650,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {s.value ?? '—'}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {s.bureau}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {s.value === null
                    ? 'Not available in this report'
                    : (s.model ?? 'Model not supplied')}
                </Typography>
                {range && (
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    {range[0]}–{range[1]}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        {data.scores[0]?.date
          ? 'Report dated ' + formatReportDate(data.scores[0].date)
          : 'Report date not supplied'}
        {data.scores.some((s) => !s.range) &&
          ' · Rating scales unavailable without published model/range details.'}
      </Typography>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: { xs: 1.5, lg: 2.25 },
          m: 0,
          mt: { xs: 2, lg: 2.5 },
          pt: { xs: 2, lg: 2.5 },
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {metrics.map(([key, label, unit, Icon], index) => {
          const f = data.metrics[key];
          const value = !f || f.value === null || f.quality === 'UNKNOWN' ? null : f.value;
          return (
            <Box
              key={key}
              component={Link}
              to={
                '/app/credit-center/profile' +
                (key === 'aggregateUtilization' ? '#utilization' : '')
              }
              sx={{
                color: 'inherit',
                minWidth: 0,
                gridColumn: index < 3 ? 'span 2' : 'span 3',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 0.75,
                textDecoration: 'none',
                '&:hover dt': { color: 'primary.main' },
              }}
            >
              <Icon
                aria-hidden="true"
                sx={{ fontSize: 20, color: 'primary.light', mt: 0.25, flexShrink: 0 }}
              />
              <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <Typography
                  component="dt"
                  variant="caption"
                  color="text.secondary"
                  sx={{ order: 1, lineHeight: 1.4 }}
                >
                  {label}
                </Typography>
                <Typography
                  component="dd"
                  sx={{
                    m: 0,
                    fontSize: value === null ? 12 : 16,
                    fontWeight: 600,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {f?.quality === 'NOT_APPLICABLE'
                    ? 'Not applicable'
                    : value === null
                      ? 'Not available in this report'
                      : (unit === '$' ? '$' : '') +
                        value.toLocaleString() +
                        (unit === '%' ? '%' : '')}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
      {Object.values(data.metrics).some((f) => f.quality === 'PARTIAL') && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Partial coverage · Calculation basis and inquiry window not supplied.
        </Typography>
      )}
      {(data.metrics.derogatoryItems?.value ?? 0) > 0 && (
        <Typography variant="body2" sx={{ mt: 1 }} color="warning.main">
          Reported negative items: {data.metrics.derogatoryItems?.value}
        </Typography>
      )}
    </Panel>
  );
}

/** Renders one screen model; a future atomic screen query can replace the compatibility adapter. */
export function CreditOverviewView({
  model,
  retryPlan,
}: {
  model: OverviewModel;
  retryPlan?: () => void;
}) {
  const m = model;
  const columns = { xs: '1fr', lg: 'minmax(0,1.35fr) repeat(2,minmax(0,1fr))' };
  return (
    <Stack spacing={{ xs: 2.5, lg: 3 }} data-lifecycle={m.lifecycle}>
      {m.banner && (
        <Alert
          severity={m.banner.tone}
          icon={<InfoOutlined />}
          sx={{
            border: 1,
            borderColor: m.banner.tone === 'warning' ? 'warning.main' : portalSurfaces.border,
            bgcolor: 'rgba(26,131,115,.09)',
            borderRadius: '10px',
          }}
        >
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{m.banner.title}</Typography>
          <Typography variant="body2">{m.banner.body}</Typography>
          {m.lifecycle === 'STALE_PUBLISHED_PROFILE' && (
            <Destination to={m.reviewDestination}>Check your Review</Destination>
          )}
        </Alert>
      )}
      {!m.snapshot ? (
        <>
          <Panel
            title={
              m.lifecycle === 'REVIEW_IN_PROGRESS_UNPUBLISHED'
                ? 'Your reviewed picture is taking shape'
                : 'Build your first credit snapshot'
            }
          >
            <Typography color="text.secondary" sx={{ maxWidth: 640, mb: 3 }}>
              No published Credit Review yet. This space will bring together reviewed facts and your
              consultant’s published guidance.
            </Typography>
            <Button
              component={Link}
              to={m.reviewDestination}
              variant="contained"
              endIcon={<ArrowForwardRounded />}
            >
              {m.lifecycle === 'REVIEW_IN_PROGRESS_UNPUBLISHED'
                ? 'Follow your Review'
                : 'Check your Review options'}
            </Button>
          </Panel>
          <Box>
            <Typography component="h2" variant="h4" sx={{ mb: 2 }}>
              What you’ll see after your Review
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,1fr)' },
                gap: 2,
              }}
            >
              {[
                [CreditScoreRounded, 'Credit Snapshot'],
                [InsightsOutlined, 'Professional Analysis'],
                [RouteRounded, 'Your Plan'],
                [HistoryRounded, 'History over time'],
              ].map(([Icon, label]) => {
                const PreviewIcon = Icon as typeof CreditScoreRounded;
                return (
                  <Stack
                    key={String(label)}
                    spacing={1}
                    sx={{ p: 2.5, borderLeft: 1, borderColor: portalSurfaces.border }}
                  >
                    <PreviewIcon color="primary" />
                    <Typography variant="body2">{String(label)}</Typography>
                  </Stack>
                );
              })}
            </Box>
          </Box>
          <Destination to="/app/support?new=1&category=CREDIT_REVIEW">
            Ask about credit reviews
          </Destination>
        </>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: columns, gap: { xs: 2, lg: 3 } }}>
            <Snapshot data={m.snapshot} />
            <Panel
              title={m.changes.state === 'BASELINE' ? 'Your Baseline' : 'What Changed'}
              eyebrow="Compared facts"
              action={
                m.changes.state !== 'BASELINE' ? (
                  <Destination to="/app/credit-center/history">View History</Destination>
                ) : undefined
              }
            >
              {m.changes.state === 'BASELINE' ? (
                <Stack spacing={1.5}>
                  <HistoryRounded color="primary" sx={{ fontSize: 32 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    This is your first reviewed credit snapshot.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Changes will appear here after a future comparable Review.
                  </Typography>
                </Stack>
              ) : !m.changes.items.length ? (
                <Stack spacing={2}>
                  <HistoryRounded color="primary" />
                  <Typography>No reliable comparison available</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Previous publications are available in History. Matching scoring models and
                    calculation coverage are not supplied, so we cannot show a reliable change.
                  </Typography>
                </Stack>
              ) : (
                m.changes.items.map((c) => (
                  <Box key={c.key} sx={{ py: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="body2">{c.label}</Typography>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography>
                        {c.previous} → {c.current}
                      </Typography>
                      <Typography color="primary.main">
                        {c.delta > 0 ? '+' : ''}
                        {c.delta}
                        {c.suffix}
                      </Typography>
                    </Stack>
                  </Box>
                ))
              )}
            </Panel>
            <Panel
              title="What Matters Now"
              eyebrow="Published interpretation"
              action={
                m.findings.total > 3 ? (
                  <Destination to="/app/credit-center/analysis">View all Analysis</Destination>
                ) : undefined
              }
            >
              {m.findings.items.length ? (
                <Stack spacing={2.5}>
                  {m.findings.items.map((f, i) => (
                    <Stack key={f.code + i} direction="row" spacing={1.5}>
                      <FindingSymbol severity={f.severity} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {f.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {f.summary}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No separate findings were included in this publication. Your published assessment
                  is shown below when available.
                </Typography>
              )}
            </Panel>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: columns, gap: { xs: 2, lg: 3 } }}>
            <Panel
              title="Consultant Assessment"
              assessment
              eyebrow="Professional guidance"
              action={
                m.assessment ? (
                  <Destination to="/app/credit-center/analysis">View full Analysis</Destination>
                ) : undefined
              }
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', mb: 1.5, color: 'primary.main' }}
              >
                <InsightsOutlined sx={{ fontSize: 24 }} />
                <Typography variant="caption">Published professional assessment</Typography>
              </Stack>
              <Typography variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {m.assessment ?? 'No assessment text was included in this publication.'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                Published {formatReportDate(m.publishedAt)}
              </Typography>
            </Panel>
            <Panel
              title="Current Priorities"
              eyebrow="From your published Plan"
              action={
                m.priorities.available ? (
                  <Destination to="/app/credit-center/plan">View full Plan</Destination>
                ) : undefined
              }
            >
              {m.priorities.status === 'error' ? (
                <>
                  <Typography variant="body2">
                    Your current Plan could not be loaded. Published credit facts remain available.
                  </Typography>
                  <Button onClick={retryPlan}>Retry Plan</Button>
                </>
              ) : m.priorities.status === 'loading' ? (
                <Typography role="status">Loading current priorities…</Typography>
              ) : (
                <>
                  {m.priorities.stale && (
                    <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
                      This Plan needs review. Check its current guidance before acting.
                    </Typography>
                  )}
                  {m.priorities.noAction && (
                    <Stack direction="row" spacing={1.25} sx={{ mb: 2, alignItems: 'flex-start' }}>
                      <CheckCircleOutlineRounded color="primary" sx={{ fontSize: 28 }} />
                      <Typography variant="body2">
                        No immediate action is required by your published Plan.
                      </Typography>
                    </Stack>
                  )}
                  {m.priorities.items.length ? (
                    <Stack component="ol" sx={{ p: 0, m: 0, listStyle: 'none', gap: 2 }}>
                      {m.priorities.items.map((item, i) => (
                        <Stack component="li" direction="row" spacing={1.5} key={item.id}>
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              flexShrink: 0,
                              borderRadius: '50%',
                              display: 'grid',
                              placeItems: 'center',
                              background: designTokens.gradient.brand,
                              color: designTokens.accent.text,
                              fontSize: 13,
                              fontWeight: 750,
                            }}
                          >
                            {i + 1}
                          </Box>
                          <Box>
                            <ButtonBase
                              component={Link}
                              to={planStepUrl(item)}
                              sx={{
                                textAlign: 'left',
                                justifyContent: 'flex-start',
                                minHeight: 28,
                              }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {item.title}
                              </Typography>
                            </ButtonBase>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block' }}
                            >
                              {item.type.toLowerCase()} · {presentStatus(item.status).label}
                            </Typography>
                          </Box>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    !m.priorities.noAction && (
                      <Typography variant="body2" color="text.secondary">
                        {m.priorities.available
                          ? 'No current steps are included in this Plan.'
                          : 'No published Plan is available yet.'}
                      </Typography>
                    )
                  )}
                </>
              )}
            </Panel>
            <Panel
              title="Progress / Next Opportunity"
              eyebrow="Your current focus"
              action={
                m.progress ? <Destination to="/app/journey">View Journey</Destination> : undefined
              }
            >
              {m.progress ? (
                <Box sx={{ position: 'relative', pl: 4 }}>
                  <Box
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 2,
                      width: 18,
                      height: 18,
                      border: '2px solid',
                      borderColor: 'primary.main',
                      borderRadius: '50%',
                      bgcolor: portalSurfaces.chrome,
                      boxShadow: '0 0 14px rgba(102,216,189,.18)',
                    }}
                  />
                  <Box
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      left: 8,
                      top: 24,
                      bottom: 4,
                      width: 2,
                      background: 'linear-gradient(rgba(102,216,189,.5), transparent)',
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {m.progress.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {m.progress.detail}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'inline-block',
                      mt: 1.5,
                      mb: 1,
                      px: 1,
                      py: 0.5,
                      borderRadius: '6px',
                      bgcolor: 'rgba(102,216,189,.08)',
                    }}
                  >
                    Next step owner:{' '}
                    {m.progress.owner === 'CLIENT'
                      ? 'You'
                      : m.progress.owner === 'CONSULTANT'
                        ? 'Your consultant'
                        : 'System'}
                  </Typography>
                  {m.progress.action && (
                    <Destination to={m.progress.action}>{m.progress.actionLabel}</Destination>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Current focus is not available. Visit Journey for your latest status.
                </Typography>
              )}
            </Panel>
          </Box>
          <Panel title="Explore your Credit Center">
            <Box
              component="nav"
              aria-label="Explore your Credit Center"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(5,minmax(0,1fr))' },
                gap: 1,
              }}
            >
              {creditCenterAreas
                .filter((a) => a.id !== 'overview')
                .map(({ id, title, detail, icon: Icon }) => (
                  <ButtonBase
                    key={id}
                    component={Link}
                    to={creditCenterPath(id)}
                    sx={{
                      p: 1.5,
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      flexDirection: { xs: 'row', lg: 'column' },
                      gap: 1,
                      border: 1,
                      borderColor: portalSurfaces.border,
                      borderRadius: '8px',
                      '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                    }}
                  >
                    <Icon color="primary" />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {detail}
                      </Typography>
                    </Box>
                    <ArrowForwardRounded sx={{ fontSize: 16 }} />
                  </ButtonBase>
                ))}
            </Box>
          </Panel>
        </>
      )}
    </Stack>
  );
}

export function CreditOverview({ read }: { read: PublishedOverviewRead }) {
  const plan = useQuery({
    queryKey: creditWorkspaceKeys.plan(),
    queryFn: () => apiRequest<ClientPlanResponse>('/api/v1/client/plan'),
    enabled: Boolean(read.current),
    retry: false,
    refetchInterval: creditWorkspaceRefetchInterval,
  });
  const model = buildOverviewModel(
    read,
    plan.isError ? undefined : plan.data,
    plan.isError ? 'error' : plan.isPending ? 'loading' : 'ready',
  );
  return <CreditOverviewView model={model} retryPlan={() => void plan.refetch()} />;
}
