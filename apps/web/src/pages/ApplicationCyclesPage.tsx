import AddRounded from '@mui/icons-material/AddRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import FlagRounded from '@mui/icons-material/FlagRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  Slider,
  Switch,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../auth/api';
import { LoadingSkeleton } from '../components/common/Feedback';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';
import { ClientReviewPage } from './ReviewPages';

type StepStatus = 'NOT_STARTED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETE' | 'SKIPPED' | 'BLOCKED';
type PrimaryGoal = {
  id: string;
  goalType: 'ZERO_APR_CREDIT' | 'TOTAL_AVAILABLE_CREDIT';
  scope: 'PERSONAL' | 'BUSINESS' | 'BOTH';
  targetAmount: number | null;
  allowAnnualFee: boolean;
  priority: 'PRIMARY' | 'SECONDARY';
  status: 'ACTIVE' | 'ACHIEVED' | 'PAUSED';
};
type Cycle = {
  id: string;
  cycleNumber: number;
  status: 'ACTIVE' | 'COMPLETE' | 'CANCELLED';
  currentStage: string;
  readinessDecision: 'READY' | 'ACTION_REQUIRED' | 'NOT_READY' | null;
  madeItToApplications: boolean;
  finalResult: string | null;
  startedAt: string;
  closedAt: string | null;
  steps: Array<{
    id: string;
    stage: string;
    title: string;
    description: string | null;
    status: StepStatus;
    sortOrder: number;
    startedAt?: string | null;
    completedAt?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
  }>;
  applications: Array<{
    id: string;
    cardName: string;
    issuer: string;
    scope: 'PERSONAL' | 'BUSINESS';
    outcome: 'APPROVED' | 'DECLINED' | 'PENDING';
    approvedLimit: number | null;
    submittedAt: string;
  }>;
};

const readinessLabels = {
  READY: 'Ready',
  ACTION_REQUIRED: 'Action required',
  NOT_READY: 'Not ready',
};

const stageGuidance: Record<
  string,
  { title?: string; description?: string; instructions: string[]; completion: string; actionLabel?: string; actionPath?: string }
> = {
  STARTED: {
    title: 'Credit goal confirmation',
    description: 'Confirm or update the primary goal that this application cycle is intended to support.',
    instructions: [
      'Review your primary credit goal and target amount.',
      'Update the goal if your desired outcome, amount, or personal/business scope changed.',
      'Save the goal to confirm it for this application cycle.',
    ],
    completion: 'The primary credit goal was confirmed for this application cycle.',
  },
  REVIEW_PURCHASE: {
    description: 'Complete a guided Credit Profile Review so your consultant can evaluate your current credit information.',
    instructions: [
      'Start the guided Review process.',
      'Provide your current credit report, recent information, and any corrections to the credit accounts shown in your profile.',
      'Submit the completed information to your consultant for review.',
    ],
    completion: 'The Credit Profile Review service was purchased for this cycle.',
    actionLabel: 'View Review service',
    actionPath: '/client/services',
  },
  CREDIT_REVIEW: {
    description: 'Complete the Review intake here without leaving your application cycle.',
    instructions: [
      'Upload the current credit-report PDF.',
      'Add recent information that may not appear on the report.',
      'Verify the credit accounts in your profile and submit the intake to your consultant.',
    ],
    completion: 'The Credit Profile Review intake was submitted and reviewed.',
    actionLabel: 'Continue Credit Profile Review',
    actionPath: '/client/credit-profile/review',
  },
  CONSULTANT_DECISION: {
    description: 'Receive the consultant’s Ready, Prepare, or Not Ready decision.',
    instructions: ['Wait for the consultant to complete the readiness decision.', 'Review the decision and selected factors when they are published.'],
    completion: 'The consultant published a readiness decision for this cycle.',
    actionLabel: 'View Credit Readiness',
    actionPath: '/client/readiness',
  },
  POST_REVIEW_ACTIONS: {
    instructions: ['Complete each active preparation action.', 'Return to Credit Readiness to monitor progress and the next milestone.'],
    completion: 'The required post-Review preparation actions were completed or cleared.',
    actionLabel: 'View action plan',
    actionPath: '/client/readiness',
  },
  ROUND_PURCHASE: {
    instructions: ['Open Services and select Optimized Credit Applications.', 'Complete the purchase to begin strategy preparation.'],
    completion: 'The optimized application service was purchased for this cycle.',
    actionLabel: 'View application service',
    actionPath: '/client/services',
  },
  STRATEGY: {
    instructions: ['Your consultant researches suitable cards and prepares the strategy.', 'Monitor this cycle for the next released step.'],
    completion: 'The consultant completed the application strategy.',
  },
  APPLICATION_SEQUENCE: {
    instructions: ['Review any client-visible preparation requirements.', 'The consultant will confirm the application order and alternatives.'],
    completion: 'The consultant finalized the application sequence.',
  },
  APPLICATION_ROUND: {
    instructions: ['Join the scheduled application session.', 'Complete only the application currently released by the consultant.'],
    completion: 'The live application session was completed.',
  },
  RESULTS: {
    instructions: ['Confirm each application result.', 'Provide approved limits or pending details where requested.'],
    completion: 'Application outcomes and approved limits were recorded.',
  },
  POST_APPLICATION_ACTIONS: {
    instructions: ['Complete pending follow-ups, reconsideration, and card setup actions.', 'Follow the consultant’s utilization and timing guidance.'],
    completion: 'Required post-application follow-up was completed.',
  },
  FINAL_RESULTS: {
    instructions: ['Review the final cycle results and goal impact.', 'Confirm that all remaining follow-ups are understood.'],
    completion: 'Final results were recorded and the application cycle was closed.',
  },
};

function CycleRoadmap({ cycle }: { cycle: Cycle }) {
  const queryClient = useQueryClient();
  const [reviewPurchaseOpen, setReviewPurchaseOpen] = useState(false);
  const [mockPaymentComplete, setMockPaymentComplete] = useState(false);
  const [reviewIntakeActive, setReviewIntakeActive] = useState(false);
  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: () => apiRequest<{ catalog: Array<{ serviceType: string; price: number | null; currency: string; active: boolean; checkoutAvailable: boolean }> }>('/api/services'),
  });
  const goalsQuery = useQuery({
    queryKey: ['goals'],
    queryFn: () => apiRequest<{ goals: PrimaryGoal[] }>('/api/v1/client/goals'),
  });
  const reviewQuery = useQuery({
    queryKey: ['review'],
    queryFn: () => apiRequest<{ review: { id: string; status: string } | null }>('/api/v1/reviews/client'),
    retry: false,
  });
  const primaryGoal =
    goalsQuery.data?.goals.find((goal) => goal.priority === 'PRIMARY' && goal.status === 'ACTIVE') ??
    null;
  const reviewService = servicesQuery.data?.catalog.find((service) => service.serviceType === 'CREDIT_PROFILE_REVIEW');
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  const [goalTarget, setGoalTarget] = useState(50000);
  const [goalScope, setGoalScope] = useState<PrimaryGoal['scope']>('PERSONAL');
  const [goalZeroApr, setGoalZeroApr] = useState(false);
  const [goalAllowAnnualFee, setGoalAllowAnnualFee] = useState(false);
  useEffect(() => {
    if (!primaryGoal) return;
    setGoalTarget(primaryGoal.targetAmount ?? 50000);
    setGoalScope(primaryGoal.scope);
    setGoalZeroApr(primaryGoal.goalType === 'ZERO_APR_CREDIT');
    setGoalAllowAnnualFee(primaryGoal.allowAnnualFee);
  }, [primaryGoal]);
  const resetGoalDraft = () => {
    setGoalTarget(primaryGoal?.targetAmount ?? 50000);
    setGoalScope(primaryGoal?.scope ?? 'PERSONAL');
    setGoalZeroApr(primaryGoal?.goalType === 'ZERO_APR_CREDIT');
    setGoalAllowAnnualFee(primaryGoal?.allowAnnualFee ?? false);
  };
  const closeGoalEditor = () => {
    resetGoalDraft();
    setGoalEditorOpen(false);
  };
  const confirmGoal = useMutation({
    mutationFn: async () => {
      const goalPayload = {
        goalType: goalZeroApr ? 'ZERO_APR_CREDIT' : 'TOTAL_AVAILABLE_CREDIT',
        scope: goalScope,
        targetAmount: goalTarget,
        allowAnnualFee: goalAllowAnnualFee,
        priority: 'PRIMARY',
      };
      if (primaryGoal) {
        await apiRequest(`/api/v1/client/goals/${primaryGoal.id}`, {
          method: 'PATCH',
          body: JSON.stringify(goalPayload),
        });
      } else {
        await apiRequest('/api/v1/client/goals', {
          method: 'POST',
          body: JSON.stringify(goalPayload),
        });
      }
      await apiRequest(`/api/v1/client/application-cycles/${cycle.id}/confirm-goal`, {
        method: 'POST',
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['goals'] }),
        queryClient.invalidateQueries({ queryKey: ['application-cycles'] }),
      ]);
    },
  });
  const mockReviewPayment = useMutation({
    mutationFn: () => apiRequest(`/api/v1/client/application-cycles/${cycle.id}/mock-review-payment`, { method: 'POST' }),
    onSuccess: async () => {
      setMockPaymentComplete(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['application-cycles'] }),
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['review'] }),
      ]);
    },
  });
  const reviewPurchaseStep = cycle.steps.find((step) => step.stage === 'REVIEW_PURCHASE');
  const reviewIntakeStep = cycle.steps.find((step) => step.stage === 'CREDIT_REVIEW');
  const roadmapSteps = cycle.steps.filter((step) => step.stage !== 'CREDIT_REVIEW');
  const isStepDone = (step: Cycle['steps'][number]) =>
    ['COMPLETE', 'SKIPPED'].includes(step.status);
  const isRoadmapStepDone = (step: Cycle['steps'][number]) =>
    step.stage === 'REVIEW_PURCHASE' && reviewIntakeStep
      ? isStepDone(step) && isStepDone(reviewIntakeStep)
      : isStepDone(step);
  const complete = roadmapSteps.filter(isRoadmapStepDone).length;
  const currentStep = cycle.steps.find((step) =>
    ['AVAILABLE', 'IN_PROGRESS'].includes(step.status),
  );
  const currentRoadmapStep = currentStep?.stage === 'CREDIT_REVIEW'
    ? reviewPurchaseStep
    : currentStep;
  const latestCompletedStep = [...roadmapSteps]
    .reverse()
    .find(isRoadmapStepDone);
  const [selectedStepId, setSelectedStepId] = useState(
    currentRoadmapStep?.id ?? latestCompletedStep?.id ?? roadmapSteps[0]?.id,
  );
  useEffect(() => {
    setSelectedStepId(currentRoadmapStep?.id ?? latestCompletedStep?.id ?? roadmapSteps[0]?.id);
  }, [cycle.id, currentRoadmapStep?.id, latestCompletedStep?.id]);
  const selectedStep =
    roadmapSteps.find((step) => step.id === selectedStepId) ?? currentRoadmapStep ?? roadmapSteps[0];
  return (
    <Stack spacing={2.25}>
      <Box>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" color="primary">Active application cycle</Typography>
            <Typography variant="h3">Cycle {cycle.cycleNumber}</Typography>
          </Box>
          <Chip label={`${complete} of ${roadmapSteps.length} complete`} color="info" />
        </Stack>
        <LinearProgress
          variant="determinate"
          value={(complete / roadmapSteps.length) * 100}
          sx={{ mt: 1.25 }}
        />
      </Box>
      <Box>
        <Typography variant="overline" color="text.secondary">Full roadmap</Typography>
        <Box
          sx={{
            display: 'grid', gridTemplateColumns: '1fr',
            gap: 1, mt: 1,
          }}
        >
        {roadmapSteps.map((step, index) => {
          const isReviewGroup = step.stage === 'REVIEW_PURCHASE' && Boolean(reviewIntakeStep);
          const reviewPhases = isReviewGroup ? [step, reviewIntakeStep!] : [];
          const detailStep = isReviewGroup
            ? reviewPhases.find((phase) => ['AVAILABLE', 'IN_PROGRESS'].includes(phase.status))
              ?? [...reviewPhases].reverse().find(isStepDone)
              ?? step
            : step;
          const done = isRoadmapStepDone(step);
          const active = isReviewGroup
            ? reviewPhases.some((phase) => ['AVAILABLE', 'IN_PROGRESS'].includes(phase.status))
            : ['AVAILABLE', 'IN_PROGRESS'].includes(step.status);
          const guidance = stageGuidance[detailStep.stage];
          const currentReviewStatus = reviewQuery.data?.review?.status;
          const reviewSubmitted = isReviewGroup && ['INFORMATION_RECEIVED', 'CONSULTANT_REVIEW'].includes(currentReviewStatus ?? '');
          const reviewFinished = isReviewGroup && currentReviewStatus === 'COMPLETE';
          const displayTitle = isReviewGroup ? 'Credit Profile Review' : (guidance?.title ?? step.title);
          const selected = step.id === selectedStep?.id;
          const confirmedGoal = step.stage === 'STARTED'
            ? goalsQuery.data?.goals.find((goal) => goal.id === step.sourceId) ?? primaryGoal
            : null;
          return (
            <Box
              key={step.id}
              sx={{
                borderRadius: 1.75, border: '1px solid',
                borderColor: selected
                  ? done
                    ? 'rgba(66, 230, 164, .72)'
                    : active
                      ? 'rgba(69, 215, 240, .78)'
                      : 'rgba(139, 124, 246, .58)'
                  : 'divider',
                background: selected
                  ? done
                    ? 'linear-gradient(135deg, #102b3d 0%, #123348 58%, #10283b 100%)'
                    : active
                      ? 'linear-gradient(135deg, #0d2941 0%, #103148 58%, #0c263c 100%)'
                      : 'linear-gradient(135deg, #182b43 0%, #1b2c47 58%, #17253c 100%)'
                  : 'rgba(5, 13, 29, .28)',
                boxShadow: selected
                  ? done
                    ? '0 0 0 1px rgba(66, 230, 164, .12), 0 12px 30px rgba(0, 0, 0, .24)'
                    : active
                      ? '0 0 0 1px rgba(69, 215, 240, .13), 0 12px 30px rgba(0, 0, 0, .24)'
                      : '0 0 0 1px rgba(139, 124, 246, .1), 0 12px 30px rgba(0, 0, 0, .24)'
                  : 'none',
                overflow: 'hidden',
                transition: 'border-color 180ms ease, box-shadow 180ms ease, background 180ms ease',
              }}
            >
              <ButtonBase
                onClick={() => setSelectedStepId(selected ? undefined : step.id)}
                aria-expanded={selected}
                sx={{
                  width: '100%', minHeight: 58, px: 1.25, py: 1, gap: 1.1,
                  justifyContent: 'flex-start', textAlign: 'left',
                }}
              >
                <Box
                  sx={{
                    width: 30, height: 30, flex: '0 0 auto',
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: done
                      ? 'success.main'
                      : active || selected
                        ? 'primary.main'
                        : 'action.disabledBackground',
                    color: done || active || selected ? 'background.default' : 'text.disabled',
                    border: '1px solid',
                    borderColor: done ? 'success.main' : active || selected ? 'primary.main' : 'divider',
                  }}
                >
                  {done ? (
                    <CheckRounded sx={{ fontSize: 18 }} />
                  ) : reviewSubmitted ? (
                    <HistoryRounded sx={{ fontSize: 17 }} />
                  ) : active ? (
                    <PlayArrowRounded sx={{ fontSize: 18 }} />
                  ) : (
                    <Typography variant="caption" sx={{ fontWeight: 900 }}>{index + 1}</Typography>
                  )}
                </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: active || selected ? 900 : 750, lineHeight: 1.25 }}>
                  {displayTitle}
                </Typography>
                <Typography variant="caption" color={done ? 'success.main' : active ? 'primary.main' : 'text.secondary'}>
                  {done || reviewFinished ? 'Completed' : reviewSubmitted ? (currentReviewStatus === 'CONSULTANT_REVIEW' ? 'Consultant reviewing' : 'Submitted') : active ? (detailStep.status === 'IN_PROGRESS' ? 'In progress' : 'Current step') : detailStep.status === 'BLOCKED' ? 'Blocked' : 'Upcoming'}
                </Typography>
              </Box>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    color: selected ? 'primary.main' : 'text.secondary',
                    bgcolor: selected ? 'rgba(69, 215, 240, .1)' : 'rgba(255, 255, 255, .035)',
                  }}
                >
                  <ExpandMoreRounded
                    sx={{
                      fontSize: 22,
                      transform: selected ? 'rotate(180deg)' : 'none',
                      transition: 'transform 180ms ease',
                    }}
                  />
                </Box>
              </ButtonBase>
              <Collapse in={selected} timeout={220} unmountOnExit>
                <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 2, pt: 0.5, borderTop: 1, borderColor: 'rgba(130, 207, 232, .24)' }}>
                  <Typography color="text.primary" sx={{ mt: 1.25 }}>
                    {reviewSubmitted
                      ? currentReviewStatus === 'CONSULTANT_REVIEW'
                        ? 'Your consultant is reviewing the information you submitted.'
                        : 'Your Review intake was submitted successfully and is waiting for your consultant.'
                      : reviewFinished
                        ? 'Your consultant completed the Review and updated your Credit Profile.'
                        : guidance?.description ?? step.description}
                  </Typography>
                  {!done && !reviewSubmitted && !reviewFinished && guidance && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="overline" color="primary">
                        {active ? 'How to complete this step' : 'What to expect'}
                      </Typography>
                      <Stack spacing={0.7} sx={{ mt: 0.75 }}>
                        {guidance.instructions.map((instruction) => (
                          <Stack key={instruction} direction="row" spacing={0.85} sx={{ alignItems: 'flex-start' }}>
                            <CheckRounded color="primary" sx={{ fontSize: 18, mt: 0.15 }} />
                            <Typography variant="body2" color="text.primary">
                              {instruction}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}
                  {(reviewSubmitted || reviewFinished) && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="overline" color="primary">Review progress</Typography>
                      <Stack spacing={0.85} sx={{ mt: 0.75 }}>
                        {[
                          { title: 'Information submitted', detail: 'No action is needed right now. You’ll be notified when your consultant starts or requests more information.', complete: true, active: false },
                          { title: 'Consultant Review started', detail: currentReviewStatus === 'INFORMATION_RECEIVED' ? 'Waiting for your consultant to begin reviewing the report and information you submitted.' : 'Your consultant is verifying the uploaded report, confirmed credit accounts, and recent information you provided.', complete: currentReviewStatus === 'CONSULTANT_REVIEW' || reviewFinished, active: currentReviewStatus === 'INFORMATION_RECEIVED' },
                          { title: 'Credit Profile updated', detail: reviewFinished ? 'Your verified Credit Profile is now available. Continue to the next stage to view the consultant readiness decision.' : currentReviewStatus === 'CONSULTANT_REVIEW' ? 'Your consultant is preparing the verified Credit Profile that will be used for the readiness decision in the next stage.' : 'Your Credit Profile will update after the consultant verifies the submitted information and completes the Review.', complete: reviewFinished, active: currentReviewStatus === 'CONSULTANT_REVIEW' },
                        ].map((reviewStage, reviewStageIndex) => (
                          <Stack
                            key={reviewStage.title}
                            direction="row"
                            spacing={1}
                            sx={{
                              p: 1.2,
                              alignItems: 'flex-start',
                              borderRadius: 1.35,
                              border: 1,
                              borderColor: reviewStage.complete
                                ? 'rgba(66, 230, 164, .32)'
                                : reviewStage.active
                                  ? 'rgba(69, 215, 240, .42)'
                                  : 'divider',
                              bgcolor: reviewStage.complete
                                ? 'rgba(66, 230, 164, .055)'
                                : reviewStage.active
                                  ? 'rgba(69, 215, 240, .065)'
                                  : 'rgba(5, 13, 29, .2)',
                            }}
                          >
                            <Box sx={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', border: 1, borderColor: reviewStage.complete ? 'success.main' : reviewStage.active ? 'primary.main' : 'divider', bgcolor: reviewStage.complete ? 'success.main' : reviewStage.active ? 'rgba(69, 215, 240, .12)' : 'rgba(255,255,255,.025)', color: reviewStage.complete ? 'background.default' : reviewStage.active ? 'primary.main' : 'text.disabled' }}>
                              {reviewStage.complete ? <CheckRounded sx={{ fontSize: 17 }} /> : <Typography variant="caption" sx={{ fontWeight: 900 }}>{reviewStageIndex + 1}</Typography>}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="body2" sx={{ fontWeight: 900, color: reviewStage.active ? 'primary.main' : 'text.primary' }}>{reviewStage.title}</Typography>
                                <Typography variant="caption" sx={{ flexShrink: 0, fontWeight: 850, color: reviewStage.complete ? 'success.main' : reviewStage.active ? 'primary.main' : 'text.disabled' }}>
                                  {reviewStage.complete ? 'Done' : reviewStage.active ? 'Current' : 'Upcoming'}
                                </Typography>
                              </Stack>
                              <Typography variant="caption" color="text.secondary">{reviewStage.detail}</Typography>
                            </Box>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}
                  {active && step.stage === 'STARTED' && (
                    <Box sx={{ mt: 1.75, pt: 1.75, borderTop: 1, borderColor: 'divider' }}>
                      {goalsQuery.isLoading ? (
                        <LoadingSkeleton />
                      ) : (
                        <Stack spacing={1.5}>
                          <Box>
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                              <Box sx={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid', borderColor: 'primary.main', color: 'primary.main', display: 'grid', placeItems: 'center' }}>
                                <FlagRounded sx={{ fontSize: 14 }} />
                              </Box>
                              <Typography variant="overline" color="primary">Goal to confirm</Typography>
                            </Stack>
                            <Box
                              sx={{
                                mt: 1,
                                p: 1.5,
                                borderRadius: 1.5,
                                border: '1px solid rgba(97, 203, 225, .3)',
                                background: 'linear-gradient(115deg, #102c3e, #14394a)',
                              }}
                            >
                              <Typography sx={{ fontWeight: 900, fontSize: { xs: 18, sm: 21 }, lineHeight: 1.2 }}>
                                {goalZeroApr ? 'Build 0% APR credit' : 'Build available credit'}
                              </Typography>
                              <Typography sx={{ mt: 0.75, fontWeight: 950, fontSize: { xs: 36, sm: 42 }, lineHeight: 1, color: 'primary.main', letterSpacing: '-.045em' }}>
                                ${goalTarget.toLocaleString()}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', mt: 1.25 }}>
                              {[
                                ['Scope', goalScope === 'BOTH' ? 'Personal + business' : goalScope === 'BUSINESS' ? 'Business' : 'Personal'],
                                ['Card focus', goalZeroApr ? '0% APR' : 'Available credit'],
                                ['Card fees', goalAllowAnnualFee ? 'Allowed' : 'Free only'],
                              ].map(([label, value], detailIndex) => (
                                <Box key={label} sx={{ px: detailIndex === 0 ? 0 : 1, borderLeft: detailIndex === 0 ? 0 : '1px solid rgba(255,255,255,.12)', minWidth: 0 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                                    {label}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', mt: 0.2, fontWeight: 800, lineHeight: 1.25 }}>
                                    {value}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1}>
                            <Button variant="outlined" onClick={() => { resetGoalDraft(); setGoalEditorOpen(true); }}>
                              Update goal
                            </Button>
                            <Button
                              variant="contained"
                              onClick={() => confirmGoal.mutate()}
                              disabled={confirmGoal.isPending || goalTarget < 5000 || goalTarget > 250000}
                            >
                              {confirmGoal.isPending ? 'Confirming…' : 'Confirm goal and continue'}
                            </Button>
                          </Stack>
                          {confirmGoal.isError && <Alert severity="error">{confirmGoal.error.message}</Alert>}
                        </Stack>
                      )}
                    </Box>
                  )}
                  {done && guidance && !isReviewGroup && (
                    step.stage === 'STARTED' && confirmedGoal ? (
                      <Box
                        sx={{
                          mt: 1.5,
                          pt: 1.5,
                          borderTop: '1px solid rgba(66, 230, 164, .42)',
                        }}
                      >
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: 'success.main', color: 'background.default', display: 'grid', placeItems: 'center' }}>
                            <CheckRounded sx={{ fontSize: 15 }} />
                          </Box>
                          <Typography variant="overline" color="success.main">Confirmed goal</Typography>
                        </Stack>
                        <Box
                          sx={{
                            mt: 1,
                            p: 1.5,
                            borderRadius: 1.5,
                            border: '1px solid rgba(97, 203, 225, .3)',
                            background: 'linear-gradient(115deg, #102c3e, #14394a)',
                          }}
                        >
                          <Typography sx={{ fontWeight: 900, fontSize: { xs: 18, sm: 21 }, lineHeight: 1.2 }}>
                            {confirmedGoal.goalType === 'ZERO_APR_CREDIT' ? 'Build 0% APR credit' : 'Build available credit'}
                          </Typography>
                          <Typography sx={{ mt: 0.75, fontWeight: 950, fontSize: { xs: 36, sm: 42 }, lineHeight: 1, color: 'primary.main', letterSpacing: '-.045em' }}>
                            ${(confirmedGoal.targetAmount ?? 0).toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', mt: 1.25 }}>
                          {[
                            ['Scope', confirmedGoal.scope === 'BOTH' ? 'Personal + business' : confirmedGoal.scope === 'BUSINESS' ? 'Business' : 'Personal'],
                            ['Card focus', confirmedGoal.goalType === 'ZERO_APR_CREDIT' ? '0% APR' : 'Available credit'],
                            ['Card fees', confirmedGoal.allowAnnualFee ? 'Allowed' : 'Free only'],
                          ].map(([label, value], detailIndex) => (
                            <Box key={label} sx={{ px: detailIndex === 0 ? 0 : 1, borderLeft: detailIndex === 0 ? 0 : '1px solid rgba(255,255,255,.12)', minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                                {label}
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block', mt: 0.2, fontWeight: 800, lineHeight: 1.25 }}>
                                {value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                        {step.completedAt && (
                          <Stack
                            direction="row"
                            spacing={0.7}
                            sx={{
                              mt: 1.25,
                              px: 1,
                              py: 0.75,
                              alignItems: 'center',
                              borderRadius: 1,
                              bgcolor: 'rgba(66, 230, 164, .1)',
                              color: 'success.main',
                            }}
                          >
                            <CheckRounded sx={{ fontSize: 17 }} />
                            <Typography variant="body2" sx={{ fontWeight: 850, color: 'text.primary' }}>
                              Goal confirmed · {new Date(step.completedAt).toLocaleDateString()}
                            </Typography>
                          </Stack>
                        )}
                      </Box>
                    ) : (
                      <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(66, 230, 164, .06)', borderLeft: '3px solid', borderColor: 'success.main' }}>
                        <Typography variant="body2" sx={{ fontWeight: 750 }}>{guidance.completion}</Typography>
                        {step.completedAt && (
                          <Typography variant="caption" color="text.secondary">Completed {new Date(step.completedAt).toLocaleDateString()}</Typography>
                        )}
                      </Box>
                    )
                  )}
                  {active && step.stage !== 'STARTED' && guidance?.actionPath && guidance.actionLabel && (
                    isReviewGroup ? (
                      <Button
                        variant={reviewSubmitted ? 'outlined' : 'contained'}
                        sx={{ mt: 1.75 }}
                        onClick={() => {
                          setReviewIntakeActive(detailStep.stage === 'CREDIT_REVIEW');
                          setMockPaymentComplete(false);
                          setReviewPurchaseOpen(true);
                        }}
                      >
                        {reviewSubmitted ? 'View Review status' : detailStep.stage === 'CREDIT_REVIEW' ? 'Continue Credit Profile Review' : 'Start Credit Profile Review'}
                      </Button>
                    ) : (
                      <Button component={Link} to={guidance.actionPath} variant="contained" sx={{ mt: 1.75 }}>
                        {guidance.actionLabel}
                      </Button>
                    )
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        })}
        </Box>
      </Box>
      <Dialog open={goalEditorOpen} onClose={closeGoalEditor} fullWidth maxWidth="sm">
        <DialogTitle>Update goal</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.25}>
            <Box>
              <Typography variant="overline" color="primary">Primary goal</Typography>
              <Typography variant="h3">Application target</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Adjust the goal this application cycle is intended to support.
              </Typography>
            </Box>
            <Box>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                <Typography variant="overline" color="text.secondary">Target amount</Typography>
                <Typography sx={{ fontWeight: 950, fontSize: 24, color: 'primary.main' }}>${goalTarget.toLocaleString()}</Typography>
              </Stack>
              <Slider min={5000} max={250000} step={5000} value={Math.min(Math.max(goalTarget, 5000), 250000)} onChange={(_, value) => setGoalTarget(value as number)} aria-label="Application cycle goal target" valueLabelDisplay="auto" valueLabelFormat={(value) => `$${Number(value).toLocaleString()}`} />
              <Stack direction="row" sx={{ justifyContent: 'space-between', mt: -0.5 }}>
                <Typography variant="caption" color="text.secondary">$5K</Typography>
                <Typography variant="caption" color="text.secondary">$250K</Typography>
              </Stack>
            </Box>
            <TextField label="Exact target" type="number" value={goalTarget} onChange={(event) => setGoalTarget(Number(event.target.value))} slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> }, htmlInput: { min: 5000, max: 250000, step: 5000 } }} />
            <Box>
              <Typography variant="overline" color="text.secondary">Credit type</Typography>
              <ToggleButtonGroup exclusive fullWidth value={goalScope} onChange={(_, value: PrimaryGoal['scope'] | null) => value && setGoalScope(value)} sx={{ mt: 0.75 }}>
                <ToggleButton value="PERSONAL">Personal</ToggleButton>
                <ToggleButton value="BUSINESS">Business</ToggleButton>
                <ToggleButton value="BOTH">Both</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 850 }}>Prioritize 0% APR credit</Typography>
                <Typography variant="body2" color="text.secondary">Use promotional credit as the primary target.</Typography>
              </Box>
              <Switch checked={goalZeroApr} onChange={(event) => setGoalZeroApr(event.target.checked)} />
            </Stack>
            <FormControlLabel control={<Checkbox checked={goalAllowAnnualFee} onChange={(event) => setGoalAllowAnnualFee(event.target.checked)} />} label={<Box><Typography sx={{ fontWeight: 850 }}>Allow cards with annual fees</Typography><Typography variant="body2" color="text.secondary">Leave unchecked to consider free cards only.</Typography></Box>} sx={{ alignItems: 'flex-start', m: 0 }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeGoalEditor}>Cancel</Button>
          <Button variant="contained" onClick={() => setGoalEditorOpen(false)} disabled={goalTarget < 5000 || goalTarget > 250000}>Apply changes</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={reviewPurchaseOpen}
        onClose={() => { setReviewPurchaseOpen(false); setMockPaymentComplete(false); setReviewIntakeActive(false); }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {reviewIntakeActive ? 'Credit Profile Review' : mockPaymentComplete ? 'Payment complete' : 'Start Credit Profile Review'}
        </DialogTitle>
        <DialogContent dividers sx={reviewIntakeActive ? { px: { xs: 2, sm: 3 }, py: { xs: 2.25, sm: 3 }, bgcolor: 'rgba(5, 13, 29, .34)' } : undefined}>
          {reviewIntakeActive ? (
            <ClientReviewPage
              embedded
              onExit={() => { setReviewPurchaseOpen(false); setMockPaymentComplete(false); setReviewIntakeActive(false); }}
            />
          ) : mockPaymentComplete ? (
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: 'success.main', color: 'background.default', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <CheckRounded />
                </Box>
                <Box>
                  <Typography variant="overline" color="success.main">Payment confirmed</Typography>
                  <Typography variant="h3">Your Review is ready</Typography>
                </Box>
              </Stack>
              <Typography color="text.secondary">
                Your one-time Credit Profile Review has been added to this application cycle.
              </Typography>
              <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="overline" color="primary">Next step</Typography>
                <Typography variant="h4" sx={{ mt: 0.25 }}>Provide your Review details</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.65 }}>
                  Upload report&nbsp;&nbsp;•&nbsp;&nbsp;Add recent changes&nbsp;&nbsp;•&nbsp;&nbsp;Verify accounts
                </Typography>
              </Box>
              <Alert severity="info">You can save your progress and return at any time.</Alert>
            </Stack>
          ) : (
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="primary">Foundational review</Typography>
              <Typography variant="h3">Credit Profile Review</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Purchase the Review, upload your current credit report, confirm information not shown on the report, and verify the credit-card accounts included in your Credit Profile before submitting everything to your consultant.
              </Typography>
            </Box>
            <Stack spacing={1}>
              {['Credit-report PDF upload', 'Additional information check', 'Credit Profile account verification', 'Consultant review and readiness result'].map((item) => (
                <Stack key={item} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <CheckRounded color="primary" sx={{ fontSize: 18 }} />
                  <Typography variant="body2" sx={{ fontWeight: 750 }}>{item}</Typography>
                </Stack>
              ))}
            </Stack>
            <Box sx={{ p: 1.75, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'rgba(5, 13, 29, .34)' }}>
              <Typography variant="overline" color="primary">Checkout summary</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.75, alignItems: 'center' }}>
                <Typography sx={{ fontSize: 32, lineHeight: 1, fontWeight: 950, color: 'primary.main', letterSpacing: '-.035em' }}>
                  {reviewService?.price == null
                    ? 'Pending'
                    : new Intl.NumberFormat(undefined, { style: 'currency', currency: reviewService.currency }).format(reviewService.price)}
                </Typography>
                <Chip size="small" label="One time" variant="outlined" />
              </Stack>
              <Typography sx={{ mt: 1.25, fontWeight: 900, fontSize: 18 }}>
                Credit Profile Review
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.5 }}>
                Includes consultant analysis, a readiness decision, and recommended next steps.
              </Typography>
              <Box sx={{ mt: 1.25, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontWeight: 800 }}>
                  No subscription. No recurring charges.
                </Typography>
              </Box>
            </Box>
            {!import.meta.env.DEV && !reviewService?.checkoutAvailable && (
              <Alert severity="info">
                Secure checkout is temporarily unavailable while payment setup is completed.
              </Alert>
            )}
          </Stack>
          )}
        </DialogContent>
        {reviewIntakeActive ? (
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => { setReviewPurchaseOpen(false); setMockPaymentComplete(false); setReviewIntakeActive(false); }}>
              Close
            </Button>
          </DialogActions>
        ) : <DialogActions sx={{ px: 3, py: 2 }}>
          {mockPaymentComplete ? (
            <>
              <Button onClick={() => { setReviewPurchaseOpen(false); setMockPaymentComplete(false); }}>
                Not now
              </Button>
              <Button variant="contained" onClick={() => setReviewIntakeActive(true)}>
                Start Credit Profile Review
              </Button>
            </>
          ) : <>
          <Button onClick={() => { setReviewPurchaseOpen(false); setMockPaymentComplete(false); }}>Not now</Button>
          {import.meta.env.DEV ? (
            <Button variant="contained" onClick={() => mockReviewPayment.mutate()} disabled={mockReviewPayment.isPending || !reviewService?.active || reviewService.price == null}>
              {mockReviewPayment.isPending ? 'Processing…' : 'Complete mock payment'}
            </Button>
          ) : (
            <Button variant="contained" disabled={!reviewService?.active || reviewService.price == null || !reviewService.checkoutAvailable}>
              {reviewService?.checkoutAvailable ? 'Continue to secure checkout' : 'Checkout coming soon'}
            </Button>
          )}
          </>}
        </DialogActions>}
        {!reviewIntakeActive && !mockPaymentComplete && mockReviewPayment.isError && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>{mockReviewPayment.error.message}</Alert>}
      </Dialog>
    </Stack>
  );
}

export function ApplicationCyclesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'ACTIVE' | 'PAST'>('ACTIVE');
  const query = useQuery({
    queryKey: ['application-cycles'],
    queryFn: () => apiRequest<{ cycles: Cycle[] }>('/api/v1/client/application-cycles'),
  });
  const start = useMutation({
    mutationFn: () => apiRequest('/api/v1/client/application-cycles', { method: 'POST' }),
    onSuccess: async () => {
      setTab('ACTIVE');
      await queryClient.invalidateQueries({ queryKey: ['application-cycles'] });
    },
  });
  const cycles = query.data?.cycles ?? [];
  const active = cycles.find((cycle) => cycle.status === 'ACTIVE') ?? null;
  const past = cycles.filter((cycle) => cycle.status !== 'ACTIVE');
  const resetCycle = useMutation({
    mutationFn: () =>
      apiRequest(`/api/v1/client/application-cycles/${active!.id}/reset`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application-cycles'] }),
  });
  useEffect(() => {
    if (!active && past.length) setTab('PAST');
  }, [active, past.length]);
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) return <Alert severity="error">Unable to load application cycles.</Alert>;

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Credit applications"
        title="Application cycles"
        description="Follow every application journey from the foundational Review through strategy, applications, results, and final follow-up."
        actions={
          active && import.meta.env.DEV ? (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<RestartAltRounded />}
              onClick={() => resetCycle.mutate()}
              disabled={resetCycle.isPending}
            >
              {resetCycle.isPending ? 'Resetting…' : 'Reset cycle (dev)'}
            </Button>
          ) : !active ? (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => start.mutate()}
              disabled={start.isPending}
            >
              {start.isPending ? 'Starting…' : 'Start application cycle'}
            </Button>
          ) : undefined
        }
      />
      {start.isError && <Alert severity="error">{start.error.message}</Alert>}
      {resetCycle.isError && <Alert severity="error">{resetCycle.error.message}</Alert>}
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab value="ACTIVE" label={active ? 'Active cycle' : 'No active cycle'} />
        <Tab value="PAST" label={`Past cycles (${past.length})`} />
      </Tabs>

      {tab === 'ACTIVE' ? (
        active ? (
          <SectionCard variant="elevated">
            <CycleRoadmap cycle={active} />
          </SectionCard>
        ) : (
          <SectionCard variant="elevated" sx={{ textAlign: 'center', py: 7 }}>
            <FlagRounded color="primary" sx={{ fontSize: 52 }} />
            <Typography variant="h2" sx={{ mt: 1.5 }}>
              Start your next application journey
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 620, mx: 'auto' }}>
              One cycle keeps the Review, readiness decision, preparation, strategy, applications,
              and results coordinated from beginning to end.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => start.mutate()}
              sx={{ mt: 3 }}
            >
              Start application cycle
            </Button>
          </SectionCard>
        )
      ) : past.length ? (
        <Stack spacing={2}>
          {past.map((cycle) => (
            <SectionCard key={cycle.id}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <HistoryRounded color="primary" />
                    <Typography variant="h3">Cycle {cycle.cycleNumber}</Typography>
                    <Chip label={cycle.status === 'COMPLETE' ? 'Complete' : 'Cancelled'} />
                    {cycle.readinessDecision && (
                      <Chip
                        color={
                          cycle.readinessDecision === 'READY'
                            ? 'success'
                            : cycle.readinessDecision === 'NOT_READY'
                              ? 'error'
                              : 'warning'
                        }
                        label={readinessLabels[cycle.readinessDecision]}
                      />
                    )}
                  </Stack>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {new Date(cycle.startedAt).toLocaleDateString()} –{' '}
                    {cycle.closedAt ? new Date(cycle.closedAt).toLocaleDateString() : 'Closed'}
                  </Typography>
                  <Typography sx={{ mt: 1.25, fontWeight: 750 }}>
                    {cycle.madeItToApplications
                      ? `${cycle.applications.length} application${cycle.applications.length === 1 ? '' : 's'} submitted`
                      : cycle.readinessDecision === 'NOT_READY'
                        ? 'Did not proceed to applications'
                        : 'Closed before applications'}
                  </Typography>
                  {cycle.finalResult && (
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {cycle.finalResult}
                    </Typography>
                  )}
                </Box>
                {cycle.applications.length > 0 && (
                  <Stack spacing={1} sx={{ minWidth: { md: 300 } }}>
                    {cycle.applications.map((application) => (
                      <Stack
                        key={application.id}
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center' }}
                      >
                        <CreditCardRounded color="primary" />
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 800 }}>{application.cardName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {application.issuer}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          color={
                            application.outcome === 'APPROVED'
                              ? 'success'
                              : application.outcome === 'DECLINED'
                                ? 'error'
                                : 'warning'
                          }
                          label={application.outcome.toLowerCase()}
                        />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Stack>
            </SectionCard>
          ))}
        </Stack>
      ) : (
        <SectionCard sx={{ textAlign: 'center', py: 6 }}>
          <HistoryRounded color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h3" sx={{ mt: 1 }}>
            No past cycles yet
          </Typography>
          <Typography color="text.secondary">
            Completed and cancelled cycles will remain here.
          </Typography>
        </SectionCard>
      )}
    </Stack>
  );
}
