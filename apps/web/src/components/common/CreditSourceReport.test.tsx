import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { CreditSourceReport } from './CreditSourceReport';

test('shows report metadata and preserves the server document destination', () => {
  render(
    <CreditSourceReport
      report={{
        originalFileName: 'credit-report.pdf',
        sizeBytes: 2048,
        mimeType: 'application/pdf',
        uploadedAt: '2026-09-02T12:00:00Z',
        reportDate: '2026-08-01T12:00:00Z',
        reportSource: 'Monitoring provider',
        contentPath: '/api/v1/documents/report-1/content',
      }}
    />,
  );
  expect(screen.getByText('Report date')).toBeInTheDocument();
  expect(screen.getByText('Added to workspace')).toBeInTheDocument();
  expect(screen.getByText('2 KB')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'Preview secure source report' });
  expect(link.getAttribute('href')).toMatch(/\/api\/v1\/documents\/report-1\/content$/);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});
test('missing report offers published facts without a fake document link or source', () => {
  render(
    <MemoryRouter>
      <CreditSourceReport report={null} />
    </MemoryRouter>,
  );
  expect(screen.getByText('No source report is attached to this publication.')).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Preview secure source report' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View published Profile' })).toHaveAttribute(
    'href',
    '/app/credit-center/profile',
  );
});
