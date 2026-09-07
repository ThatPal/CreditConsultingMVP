import { Box, Button, Stack, Typography } from '@mui/material';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

export type CollectionMode = 'bounded' | 'grid' | 'inbox-detail' | 'gallery-compare' | 'load-more' | 'conversation' | 'history' | 'split-pane';

export function CollectionSurface({
  title,
  mode,
  controls,
  children,
  footer,
  empty,
  busy = false,
  maxHeight = 520,
}: {
  title: string;
  mode: CollectionMode;
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  empty?: boolean;
  busy?: boolean;
  maxHeight?: number;
}) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const saved = sessionStorage.getItem(`collection-scroll:${title}`);
    if (body.current && saved) body.current.scrollTop = Number(saved);
    return () => {
      if (body.current) sessionStorage.setItem(`collection-scroll:${title}`, String(body.current.scrollTop));
    };
  }, [title]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-collection-item]')];
    const current = rows.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? Math.min(rows.length - 1, current + 1) : Math.max(0, current - 1);
    if (rows[next]) { event.preventDefault(); rows[next].focus(); }
  };
  return (
    <Box data-collection-mode={mode} aria-busy={busy} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden', bgcolor: 'rgba(13,21,40,.72)' }}>
      <Stack sx={{ position: 'sticky', top: 0, zIndex: 2, p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(16,24,44,.96)', backdropFilter: 'blur(12px)' }} spacing={1}>
        <Typography variant="h3">{title}</Typography>{controls}
      </Stack>
      <Box ref={body} tabIndex={0} aria-label={`${title} records`} onKeyDown={onKeyDown} sx={{ maxHeight: { xs: 'none', md: maxHeight }, overflowY: { xs: 'visible', md: 'auto' }, overscrollBehavior: 'contain', p: 2 }}>
        {empty ? <Typography color="text.secondary">No records match this view. Adjust the filters or return when the owning workflow creates one.</Typography> : children}
      </Box>
      {footer && <Box sx={{ position: 'sticky', bottom: 0, zIndex: 2, p: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(16,24,44,.96)', backdropFilter: 'blur(12px)' }}>{footer}</Box>}
    </Box>
  );
}

export function CompareTray({ count, onClear, children }: { count: number; onClear: () => void; children?: ReactNode }) {
  if (!count) return null;
  return <Stack direction={{ xs: 'column', sm: 'row' }} aria-live="polite" sx={{ position: 'sticky', bottom: 12, zIndex: 4, gap: 1, alignItems: { sm: 'center' }, p: 1.5, borderRadius: 3, bgcolor: 'background.paper', boxShadow: 8 }}><Typography sx={{ flex: 1, fontWeight: 750 }}>{count} {count === 1 ? 'item' : 'items'} selected for comparison</Typography>{children}<Button onClick={onClear}>Clear comparison</Button></Stack>;
}
