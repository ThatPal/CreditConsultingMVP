import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { AnalysisFinding, type PublishedFindingStory } from './AnalysisFinding';

const finding: PublishedFindingStory = {
  code: 'reviewed-balance',
  title: 'Your reported balance',
  summary: 'Your consultant reviewed this reported balance.',
  severity: 'INFORMATION',
};

test('published relationships lead to the supplied source and exact Plan item', () => {
  render(
    <MemoryRouter>
      <AnalysisFinding
        finding={{
          ...finding,
          whyItMatters: 'Published explanation for this client.',
          supportingFacts: [
            { label: 'Reported balance', value: '$120', area: 'report', section: 'accounts' },
          ],
          relatedPlanItems: [{ id: 'step/one', title: 'Review the balance' }],
        }}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText('Published explanation for this client.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Evidence & related work' }));
  expect(screen.getByRole('link', { name: 'View reported balance' })).toHaveAttribute(
    'href',
    '/app/credit-center/report#accounts',
  );
  expect(screen.getByRole('link', { name: 'Plan · Review the balance' })).toHaveAttribute(
    'href',
    '/app/credit-center/plan?item=step%2Fone',
  );
});

test('missing published relationships do not imply an attached Plan item', () => {
  render(
    <MemoryRouter>
      <AnalysisFinding finding={finding} />
    </MemoryRouter>,
  );
  expect(screen.getByText(/relationships were not included/)).toBeVisible();
  expect(screen.queryByRole('link', { name: /^Plan ·/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Why it matters')).not.toBeInTheDocument();
});
