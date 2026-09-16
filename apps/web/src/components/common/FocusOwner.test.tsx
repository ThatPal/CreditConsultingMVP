import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { FocusOwner, focusOwnerLabel } from './FocusOwner';
test.each([
  ['CLIENT', 'You'],
  ['CONSULTANT', 'Your consultant'],
  ['SYSTEM', 'Automated check'],
  ['UNKNOWN', 'Being confirmed'],
  [undefined, 'Being confirmed'],
])('owner %s has an explicit safe label', (owner, label) => {
  render(<FocusOwner owner={owner} />);
  expect(screen.getByText('Next step · ' + label)).toBeInTheDocument();
});
test('staff labels retain the actual owner', () => {
  expect(focusOwnerLabel('CLIENT', true)).toBe('Client');
  expect(focusOwnerLabel('CONSULTANT', true)).toBe('Consultant');
});
