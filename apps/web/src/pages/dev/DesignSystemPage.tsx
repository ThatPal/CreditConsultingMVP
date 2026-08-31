import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CreditScoreRounded from '@mui/icons-material/CreditScoreRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import RocketLaunchRounded from '@mui/icons-material/RocketLaunchRounded';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  Drawer,
  FormControlLabel,
  FormHelperText,
  Grid,
  LinearProgress,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Switch,
} from '@mui/material';
import { useState } from 'react';
import {
  ConfirmDialog,
  EmptyState,
  ErrorAlert,
  LoadingSkeleton,
} from '../../components/common/Feedback';
import { FocusSurface } from '../../components/common/FocusSurface';
import { MetricCard } from '../../components/common/MetricCard';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusChip, type StatusTone } from '../../components/common/StatusChip';
import { designTokens } from '../../theme';

const statusTones: StatusTone[] = [
  'neutral',
  'info',
  'positive',
  'caution',
  'error',
  'active',
  'muted',
];

export function DesignSystemPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <Stack
      spacing={{ xs: 4, md: 6 }}
      sx={{ width: '100%', maxWidth: 1440, mx: 'auto', p: { xs: 2, sm: 3, lg: 5 } }}
    >
      <PageHeader
        eyebrow="Design system · Sprint 1.3"
        title="Dark is the environment. Light is the focus."
        description="A premium fintech system built for calm financial decisions: layered dark surfaces, selective blue–cyan–violet energy, and focused light canvases for critical reading."
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined">Secondary</Button>
            <Button variant="text">Tertiary</Button>
            <Button variant="contained" color="error">
              Destructive
            </Button>
            <Button
              variant="contained"
              startIcon={<RocketLaunchRounded />}
              onClick={() => setDialogOpen(true)}
            >
              Open dialog
            </Button>
          </Stack>
        }
      />
      <SectionCard
        variant="elevated"
        sx={{ p: { xs: 3, md: 5 }, position: 'relative', overflow: 'hidden' }}
      >
        <Grid container spacing={4} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <StatusChip label="Foundation ready" tone="active" />
            <Typography variant="h2" sx={{ mt: 2, maxWidth: 670 }}>
              A private strategy room for every credit decision.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 620, fontSize: '1.05rem' }}>
              Rich enough to feel valuable. Restrained enough to keep numbers, recommendations, and
              next steps trustworthy.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
              <Button variant="contained">Explore components</Button>
              <Button variant="contained" disabled>
                Disabled action
              </Button>
              <Button variant="text">View shell routes</Button>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box
              sx={{
                p: 3,
                borderRadius: `${designTokens.radius.lg}px`,
                border: `1px solid ${designTokens.color.borderStrong}`,
                bgcolor: 'rgba(7, 11, 24, 0.54)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Strategy foundation</Typography>
                  <AutoAwesomeRounded color="primary" />
                </Stack>
                <Typography variant="h2">92%</Typography>
                <LinearProgress
                  variant="determinate"
                  value={92}
                  aria-label="Strategy foundation 92 percent"
                  sx={{
                    height: 8,
                    borderRadius: 10,
                    '& .MuiLinearProgress-bar': { backgroundImage: designTokens.gradient.brand },
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  Theme, shells, routes, states, and accessibility patterns
                </Typography>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </SectionCard>
      <Box>
        <Typography variant="overline" color="primary">
          Reusable metrics
        </Typography>
        <Typography variant="h2" sx={{ mb: 2.5 }}>
          Numbers stay calm and legible
        </Typography>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Total available"
              value="$86,400"
              supportingText="Strong numeric hierarchy"
              icon={<CreditScoreRounded />}
              accent="gradient"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              label="Utilization"
              value="8.4%"
              supportingText="Within current strategy range"
              accent="positive"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard label="Plan actions" value="04" supportingText="Two client actions next" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard label="Loading metric" value="" loading />
          </Grid>
        </Grid>
      </Box>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <FocusSurface
            eyebrow="Credit Profile summary"
            title="Clear, focused financial context"
            action={<StatusChip label="Current" tone="positive" />}
          >
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  Current through
                </Typography>
                <Typography variant="h3">Nov 23, 2026</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  Application Readiness
                </Typography>
                <Typography variant="h3">Medium</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  Reported utilization
                </Typography>
                <Typography variant="h3">8.4%</Typography>
              </Grid>
            </Grid>
            <Alert
              icon={<CheckCircleRounded />}
              severity="success"
              sx={{
                mt: 3,
                color: designTokens.color.focusText,
                bgcolor: 'rgba(8, 127, 101, 0.10)',
              }}
            >
              <strong>Consultant recommendation:</strong> Proceed selectively while preserving the
              planned mortgage timeline.
            </Alert>
          </FocusSurface>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <FocusSurface
            eyebrow="Wizard confirmation"
            title="Review before submitting"
            variant="positive"
          >
            <Stack spacing={2}>
              <TextField
                label="Review frequency"
                value="Quarterly"
                fullWidth
                slotProps={{ input: { readOnly: true } }}
                helperText="Light-surface helper text"
              />
              <TextField select label="Primary goal" value="increase" fullWidth>
                <MenuItem value="increase">Increase total available credit</MenuItem>
              </TextField>
              <Typography color="text.secondary">
                Secondary guidance remains readable without flattening semantic colors.
              </Typography>
              <FormControlLabel control={<Checkbox defaultChecked />} label="Confirm strategy" />
              <Link href="#focus-correction-evidence">Review accessible guidance</Link>
              <Button variant="contained">Confirm details</Button>
            </Stack>
          </FocusSurface>
        </Grid>
      </Grid>
      <SectionCard>
        <Box id="focus-correction-evidence" sx={{ mb: 3 }}>
          <Typography variant="overline" color="primary">
            Focus correction evidence
          </Typography>
          <Typography variant="h2">One intentional keyboard-focus treatment</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Focus the outlined field and button: the field uses its notched border while the button
            retains the global focus-visible ring.
          </Typography>
        </Box>
        <Typography variant="overline" color="primary">
          Controls and interaction states
        </Typography>
        <Typography variant="h2" sx={{ mb: 2.5 }}>
          Accessible inputs and overlays
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={2}>
              <TextField
                label="Applicant name"
                defaultValue="Jordan Lee"
                helperText="Synthetic showcase data"
                slotProps={{ htmlInput: { 'data-focus-evidence': 'outlined-input' } }}
              />
              <TextField
                label="Email"
                defaultValue="invalid"
                error
                helperText="Enter a valid email address"
              />
              <TextField select label="Review cadence" defaultValue="monthly">
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="quarterly">Quarterly</MenuItem>
              </TextField>
              <FormControlLabel
                control={<Checkbox defaultChecked />}
                label="Include utilization alerts"
              />
              <RadioGroup row defaultValue="personal" aria-label="Account type">
                <FormControlLabel value="personal" control={<Radio />} label="Personal" />
                <FormControlLabel value="business" control={<Radio />} label="Business" />
              </RadioGroup>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Strategy notifications"
              />
              <FormHelperText>
                All controls expose labels, selected, disabled, and error semantics.
              </FormHelperText>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Tooltip title="Synthetic guidance only">
                <Button variant="outlined">Hover or focus for guidance</Button>
              </Tooltip>
              <Button startIcon={<MenuRounded />} onClick={() => setDrawerOpen(true)}>
                Open drawer
              </Button>
              <Button variant="contained" disabled>
                Blocked action
              </Button>
              <Button variant="contained" loading>
                Loading action
              </Button>
              <Alert severity="warning">
                Blocked: consultant approval is required before submission.
              </Alert>
            </Stack>
          </Grid>
        </Grid>
      </SectionCard>
      <FocusSurface eyebrow="Report-like view" title="Account summary table">
        <Box sx={{ overflowX: 'auto' }}>
          <Table
            size="small"
            sx={{
              minWidth: 520,
              '& .MuiTableCell-root': {
                color: designTokens.color.focusText,
                borderColor: designTokens.color.focusBorder,
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Account</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Limit</TableCell>
                <TableCell align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Primary revolving account</TableCell>
                <TableCell>Open</TableCell>
                <TableCell align="right">$24,000</TableCell>
                <TableCell align="right">$1,180</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Business revolving account</TableCell>
                <TableCell>Open</TableCell>
                <TableCell align="right">$18,500</TableCell>
                <TableCell align="right">$0</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box aria-label="Loading table state" aria-busy="true">
              <Typography variant="caption">Loading table state</Typography>
              <LoadingSkeleton />
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Table size="small" aria-label="Empty table state">
              <TableHead>
                <TableRow>
                  <TableCell>Recent applications</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>No applications match this view.</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Grid>
        </Grid>
      </FocusSurface>
      <Grid container spacing={2.5}>
        {(['neutral', 'positive'] as const).map((variant) => (
          <Grid key={variant} size={{ xs: 12, lg: 6 }}>
            <FocusSurface
              eyebrow={`${variant} light-surface evidence`}
              title={`Recent Applications — ${variant}`}
              variant={variant}
            >
              <Table size="small" aria-label={`Recent Applications ${variant}`}>
                <TableHead>
                  <TableRow>
                    <TableCell>Applicant</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Updated</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      Jordan Lee
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        Mortgage readiness review
                      </Typography>
                    </TableCell>
                    <TableCell>In review</TableCell>
                    <TableCell align="right">Today</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Stack
                spacing={2}
                sx={{ mt: 2.5 }}
                aria-label={`${variant} light-surface loading indicators`}
              >
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <CircularProgress size={26} aria-label={`${variant} circular loading`} />
                  <LinearProgress
                    variant="determinate"
                    value={64}
                    aria-label={`${variant} progress 64 percent`}
                    sx={{ flex: 1, height: 8, borderRadius: 99 }}
                  />
                  <Skeleton width={72} height={30} />
                </Stack>
                {variant === 'neutral' && (
                  <Box aria-label="Shared loading skeleton on a light focus surface">
                    <LoadingSkeleton />
                  </Box>
                )}
              </Stack>
            </FocusSurface>
          </Grid>
        ))}
      </Grid>
      <Box>
        <Typography variant="overline" color="primary">
          Surfaces and states
        </Typography>
        <Typography variant="h2" sx={{ mb: 2.5 }}>
          One system, different jobs
        </Typography>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            <SectionCard>
              <Typography variant="h4">Standard surface</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Calm default content container.
              </Typography>
            </SectionCard>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <SectionCard variant="interactive">
              <Typography variant="h4">Interactive surface</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Lift and border response on hover.
              </Typography>
            </SectionCard>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <SectionCard variant="operational">
              <Typography variant="h4">Operational surface</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Denser consultant workspaces.
              </Typography>
            </SectionCard>
          </Grid>
        </Grid>
        <Stack direction="row" sx={{ mt: 2.5, flexWrap: 'wrap', gap: 1 }}>
          {statusTones.map((tone) => (
            <StatusChip key={tone} label={tone[0]!.toUpperCase() + tone.slice(1)} tone={tone} />
          ))}
        </Stack>
      </Box>
      <Divider />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <LoadingSkeleton />
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2.5}>
            <ErrorAlert message="We could not refresh this demonstration. Your existing information remains available." />
            <EmptyState
              icon={<LockRounded />}
              title="Your strategy starts here"
              description="No plan items have been added yet. Future workflows will provide the right next step without inventing business data."
              primaryAction={<Button variant="contained">Primary action</Button>}
              secondaryAction={<Button variant="outlined">Learn more</Button>}
            />
          </Stack>
        </Grid>
      </Grid>
      <ConfirmDialog
        open={dialogOpen}
        title="Confirm this action"
        description="This accessible dialog demonstrates the shared confirmation pattern for future material actions."
        onClose={() => setDialogOpen(false)}
        onConfirm={() => setDialogOpen(false)}
      />
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Stack spacing={2} sx={{ width: { xs: 280, sm: 360 }, p: 3 }}>
          <Typography variant="h3">Strategy details</Typography>
          <Typography color="text.secondary">
            A keyboard-accessible shared drawer pattern.
          </Typography>
          <Button onClick={() => setDrawerOpen(false)}>Close drawer</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
