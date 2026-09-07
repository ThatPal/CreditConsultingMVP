import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { theme } from '../../theme';
import { CommandPalette, SafeBulkActionBar, SplitWorkspace } from './EaseOfUse';

const wrap = (node: React.ReactNode) => render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);

describe('D1 ease-of-use foundations', () => {
  test('separates work and detail with named regions', () => {
    wrap(<SplitWorkspace primary={<p>Queue</p>} detail={<p>Record</p>} primaryLabel="Work queue" detailLabel="Selected client" />);
    expect(screen.getByRole('region', { name: 'Work queue' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Selected client' })).toBeInTheDocument();
  });

  test('filters commands by role and restores dialog focus through MUI', () => {
    const select = vi.fn();
    wrap(<CommandPalette open role="consultant" onClose={() => undefined} items={[{ id: 'crm', label: 'Find client', description: 'Search authorized clients', roles: ['consultant'], onSelect: select }, { id: 'admin', label: 'Pause jobs', description: 'Admin only', roles: ['admin'], onSelect: vi.fn() }]} />);
    expect(screen.getByRole('button', { name: /Find client/i })).toBeInTheDocument();
    expect(screen.queryByText('Pause jobs')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Find client/i }));
    expect(select).toHaveBeenCalledOnce();
  });

  test('fails bulk actions closed without capability', () => {
    const action = vi.fn();
    wrap(<SafeBulkActionBar selectedCount={2} capability={false} actionLabel="Archive selected records" consequence="Moves records out of the active view." onAction={action} onClear={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Archive selected records/i }));
    expect(action).not.toHaveBeenCalled();
  });
});
