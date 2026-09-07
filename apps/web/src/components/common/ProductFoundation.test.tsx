import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { theme } from '../../theme';
import { CollectionSurface } from './CollectionSurface';
import { ComparisonMatrix, FreshnessIndicator, LifecycleRail, UtilizationGauge } from './ProductFoundation';
import { freshnessLabel, humanState, isSpecificActionLabel, safeClientLabel, validateGovernedActionContent } from './contentSystem';

const wrap = (node: React.ReactNode) => render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);

describe('D1 shared product foundation', () => {
  test('centralizes safe state, freshness and action language', () => {
    expect(humanState('WAITING_FOR_CONSULTANT')).toBe('Waiting For Consultant');
    expect(safeClientLabel('b32b22a8-1596-3850-e695-81d0b2f7a2f3')).toBe('Reference available in details');
    expect(freshnessLabel('2026-09-07T11:59:00Z', new Date('2026-09-07T12:00:00Z'))).toBe('Confirmed 1 minute ago');
    expect(isSpecificActionLabel('Open')).toBe(false);
    expect(isSpecificActionLabel('Review Work Queue')).toBe(true);
    expect(validateGovernedActionContent({ action: 'Pause jobs', scope: '', effect: 'Stops claims', inFlight: 'Finishes active work', reversibility: 'Admin may resume', authority: 'Step-up MFA', evidence: 'Audit event' })).toEqual(['scope']);
  });

  test('provides accessible visual equivalents without color-only meaning', () => {
    wrap(<><UtilizationGauge value={27.4} source="Published Credit Profile" /><LifecycleRail title="Round path" items={[{ key: 'review', label: 'Review', state: 'COMPLETED' }, { key: 'strategy', label: 'Strategy', state: 'ACTIVE' }]} /><FreshnessIndicator state="reconnecting" /></>);
    expect(screen.getByRole('img', { name: /27.4 percent.*Published Credit Profile/i })).toBeInTheDocument();
    expect(screen.getByText(/Step 2 · Active/i)).toBeInTheDocument();
    expect(screen.getByText('Reconnecting').parentElement?.parentElement).toHaveAttribute('aria-live', 'polite');
  });

  test('uses semantic table fallback for comparison', () => {
    wrap(<ComparisonMatrix title="Card comparison" columns={['Card A', 'Card B']} rows={[{ label: 'Annual fee', values: ['$0', '$95'] }]} />);
    expect(screen.getByRole('table', { name: 'Card comparison' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Annual fee' })).toBeInTheDocument();
  });

  test('bounds desktop collections and supports keyboard row movement', () => {
    wrap(<CollectionSurface title="Work items" mode="bounded" footer={<button>Next page</button>}><button data-collection-item>First item</button><button data-collection-item>Second item</button></CollectionSurface>);
    const region = screen.getByLabelText('Work items records');
    const first = screen.getByRole('button', { name: 'First item' });
    first.focus();
    fireEvent.keyDown(region, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: 'Second item' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
  });
});
