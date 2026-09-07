import { Box, Button, Dialog, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ProductRole } from './contentSystem';

export function useRestorableViewState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(`view-state:${key}`);
      return stored ? JSON.parse(stored) as T : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(`view-state:${key}`, JSON.stringify(value)); } catch { /* Storage is optional; workflow state remains server-owned. */ }
  }, [key, value]);
  return [value, setValue] as const;
}

export function SplitWorkspace({ primary, detail, primaryLabel, detailLabel }: { primary: ReactNode; detail: ReactNode; primaryLabel: string; detailLabel: string }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, .9fr) minmax(420px, 1.4fr)' }, gap: 2, minHeight: { lg: 480 } }}><Box component="section" aria-label={primaryLabel} sx={{ minWidth: 0 }}>{primary}</Box><Box component="section" aria-label={detailLabel} sx={{ minWidth: 0, borderLeft: { lg: '1px solid' }, borderColor: { lg: 'divider' }, pl: { lg: 2 } }}>{detail}</Box></Box>;
}

export type CommandItem = { id: string; label: string; description: string; roles: ProductRole[]; onSelect: () => void };
export function CommandPalette({ open, role, items, onClose }: { open: boolean; role: ProductRole; items: CommandItem[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => items.filter((item) => item.roles.includes(role) && `${item.label} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [items, query, role]);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="command-palette-title"><DialogTitle id="command-palette-title">{role === 'admin' ? 'Admin commands' : 'CRM commands'}</DialogTitle><DialogContent><TextField autoFocus fullWidth label="Find an authorized command" value={query} onChange={(event) => setQuery(event.target.value)} /><List aria-label="Available commands">{visible.map((item) => <ListItemButton key={item.id} onClick={() => { item.onSelect(); onClose(); }}><ListItemText primary={item.label} secondary={item.description} /></ListItemButton>)}</List>{!visible.length && <Typography color="text.secondary">No authorized commands match this search.</Typography>}</DialogContent></Dialog>;
}

export function SafeBulkActionBar({ selectedCount, capability, actionLabel, consequence, onAction, onClear }: { selectedCount: number; capability: boolean; actionLabel: string; consequence: string; onAction: () => void; onClear: () => void }) {
  if (!selectedCount) return null;
  return <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ position: 'sticky', bottom: 12, zIndex: 5, gap: 1, alignItems: { sm: 'center' }, p: 1.5, borderRadius: 3, bgcolor: 'background.paper', boxShadow: 8 }}><Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 800 }}>{selectedCount} selected</Typography><Typography variant="caption" color="text.secondary">{consequence}</Typography></Box><Button onClick={onClear}>Clear selection</Button><Button variant="contained" disabled={!capability} onClick={onAction}>{actionLabel}</Button></Stack>;
}

export function ShortcutHelp({ shortcuts }: { shortcuts: Array<{ keys: string; effect: string }> }) {
  return <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, m: 0 }}>{shortcuts.map((shortcut) => <Box key={shortcut.keys} sx={{ display: 'contents' }}><Box component="dt"><Box component="kbd" sx={{ px: 1, py: .5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>{shortcut.keys}</Box></Box><Typography component="dd" sx={{ m: 0 }}>{shortcut.effect}</Typography></Box>)}</Box>;
}
