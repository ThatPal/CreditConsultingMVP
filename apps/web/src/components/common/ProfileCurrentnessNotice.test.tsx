import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ProfileCurrentnessNotice } from './ProfileCurrentnessNotice';
test.each([
  ['EXPIRED', 'Your published assessment has expired'],
  ['BASIS_UNCONFIRMED', 'Your published assessment needs confirmation'],
  ['REASSESSMENT_REQUIRED', 'Your Credit Profile needs reassessment'],
])('preserves the server reason %s', (reason, title) => {
  render(
    <ProfileCurrentnessNotice
      profile={{ status: 'STALE', isCurrent: false, reason, effectiveAt: '2026-09-01T12:00:00Z' }}
    />,
  );
  expect(screen.getByText(title)).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Credit Profile currentness' })).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
test.each([
  undefined,
  { status: 'CURRENT', isCurrent: true },
  { status: 'NOT_AVAILABLE', isCurrent: false, reason: 'NO_PUBLICATION' },
  { status: 'REVIEW_IN_PROGRESS', isCurrent: false },
])('does not invent a stale publication for %j', (profile) => {
  render(<ProfileCurrentnessNotice profile={profile} />);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
test('does not recalculate expiry from browser time', () => {
  render(
    <ProfileCurrentnessNotice
      profile={{ status: 'CURRENT', isCurrent: true, expiresAt: '2020-01-01' }}
    />,
  );
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
