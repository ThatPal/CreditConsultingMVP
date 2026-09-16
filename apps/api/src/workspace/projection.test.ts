import { expect, test } from 'vitest';
import { profileCurrentness, summarizePlan } from './projection.js';
const now = new Date('2026-09-15T12:00:00Z');
const publication = {
  id: 'publication',
  reviewId: 'review',
  publishedAt: new Date('2026-09-01'),
  expiresAt: new Date('2026-10-01'),
};
const state = {
  status: 'CURRENT',
  sourceReviewId: 'review',
  staleAt: null,
  updatedAt: new Date('2026-09-01'),
};
test('counts Actions separately and never equates submission with completion', () => {
  const item = {
    id: 'item',
    owner: 'CLIENT',
    title: 'Client step',
    type: 'ACTION',
    consultantRationale: 'private',
  };
  const result = summarizePlan({
    id: 'plan',
    status: 'ACTIVE',
    version: {
      id: 'version',
      version: 2,
      items: [
        { ...item, status: 'COMPLETED' },
        { ...item, status: 'AWAITING_VERIFICATION' },
        { ...item, status: 'UNABLE' },
        { ...item, status: 'CANCELLED' },
        { ...item, type: 'GUIDANCE', status: 'AVAILABLE' },
        { ...item, type: 'MILESTONE', status: 'LOCKED' },
      ],
    },
  });
  expect(result).toMatchObject({
    openActionCount: 2,
    completedActionCount: 1,
    totalActionCount: 3,
    progressPercent: 33,
    guidanceCount: 1,
    milestoneCount: 1,
    awaitingVerificationCount: 1,
    needsConsultantCount: 1,
    source: { planId: 'plan', versionId: 'version', version: 2 },
  });
  expect(result.nextClientItem).not.toHaveProperty('consultantRationale');
});
test.each([
  ['ACTIVE', now],
  ['STALE', null],
  ['APPROVED', null],
])('does not enable responses to non-executable Plan %s', (status, staleAt) => {
  const result = summarizePlan({
    status: String(status),
    version: {
      staleAt,
      items: [{ id: 'step', type: 'ACTION', owner: 'CLIENT', title: 'Step', status: 'AVAILABLE' }],
    },
  });
  expect(result.canRespond).toBe(false);
  expect(result.nextClientItem).toBeNull();
});
test('no Actions does not fabricate complete progress', () => {
  expect(summarizePlan(null)).toMatchObject({
    progressPercent: null,
    canRespond: false,
    source: null,
  });
});
test('matching current publication is current without modifying its content', () => {
  expect(profileCurrentness({ state, publication, reviewInProgress: false }, now)).toMatchObject({
    status: 'CURRENT',
    isCurrent: true,
    reason: 'CURRENT',
    source: { publicationId: 'publication', reviewId: 'review' },
  });
  expect(publication.expiresAt.toISOString()).toBe('2026-10-01T00:00:00.000Z');
});
test.each([
  [{ ...state, staleAt: now }, publication, 'REASSESSMENT_REQUIRED'],
  [{ ...state, status: 'STALE' }, publication, 'REASSESSMENT_REQUIRED'],
  [{ ...state, sourceReviewId: 'other' }, publication, 'BASIS_UNCONFIRMED'],
  [null, publication, 'BASIS_UNCONFIRMED'],
  [state, { ...publication, expiresAt: now }, 'EXPIRED'],
])('a published record alone cannot imply currentness', (basis, published, reason) => {
  expect(
    profileCurrentness({ state: basis, publication: published, reviewInProgress: false }, now),
  ).toMatchObject({ status: 'STALE', isCurrent: false, reason });
});
test.each([true, false])(
  'no publication reports review context without inventing facts',
  (reviewInProgress) => {
    expect(
      profileCurrentness({ state: null, publication: null, reviewInProgress }, now),
    ).toMatchObject({
      status: reviewInProgress ? 'REVIEW_IN_PROGRESS' : 'NOT_AVAILABLE',
      isCurrent: false,
      source: null,
    });
  },
);
