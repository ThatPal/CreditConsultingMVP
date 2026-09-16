import { Box, Button, Stack, Typography } from '@mui/material';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

export type CollectionMode =
  | 'bounded'
  | 'grid'
  | 'inbox-detail'
  | 'gallery-compare'
  | 'load-more'
  | 'conversation'
  | 'history'
  | 'split-pane';

export function CollectionSurface({
  title,
  headingComponent = 'h3',
  mode,
  controls,
  children,
  footer,
  empty,
  busy = false,
  maxHeight = 520,
  appearance = 'panel',
  scrollKey,
}: {
  title: string;
  headingComponent?: 'h2' | 'h3' | 'h4';
  mode: CollectionMode;
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  empty?: boolean;
  busy?: boolean;
  maxHeight?: number;
  appearance?: 'panel' | 'plain';
  /** Stable, account/resource/view-scoped identity. Omit to disable restoration. */
  scrollKey?: string;
}) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Capture the mounted element: React may clear the ref before cleanup.
    const element = body.current;
    if (!element) return;
    if (!scrollKey) return;
    element.scrollTop = 0;
    const key = `collection-scroll:v2:${scrollKey}`;
    try {
      const saved = sessionStorage.getItem(key);
      const offset = saved === null ? NaN : Number(saved);
      if (Number.isFinite(offset) && offset >= 0) element.scrollTop = offset;
    } catch {
      // Storage is optional presentation state, never a prerequisite for work.
    }
    return () => {
      try {
        sessionStorage.setItem(key, String(element.scrollTop));
      } catch {
        // Preserve the usable collection when storage is blocked or full.
      }
    };
  }, [scrollKey]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !['ArrowDown', 'ArrowUp'].includes(event.key)
    )
      return;
    const active = event.currentTarget.ownerDocument.activeElement;
    if (!(active instanceof HTMLElement) || !event.currentTarget.contains(active)) return;
    // Inputs, editable text, menus and nested row actions own their arrow keys.
    if (
      active.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="listbox"], [role="menu"], [role="slider"], [role="spinbutton"], [role="tablist"]',
      )
    )
      return;
    const rows = [
      ...event.currentTarget.querySelectorAll<HTMLElement>('[data-collection-item]'),
    ].filter(
      (row) =>
        row.closest('[data-collection-body]') === event.currentTarget &&
        row.tabIndex >= 0 &&
        !row.matches(':disabled, [aria-disabled="true"]') &&
        !row.closest('[hidden], [inert], [aria-hidden="true"]'),
    );
    const current = rows.indexOf(active);
    if (active !== event.currentTarget && current === -1) return;
    const next =
      current === -1
        ? event.key === 'ArrowDown'
          ? 0
          : rows.length - 1
        : current + (event.key === 'ArrowDown' ? 1 : -1);
    const target = rows[next];
    if (!target) return;
    target.focus();
    if (event.currentTarget.ownerDocument.activeElement === target) event.preventDefault();
  };
  return (
    <Box
      data-collection-mode={mode}
      aria-busy={busy}
      sx={{
        border: appearance === 'plain' ? 0 : '1px solid',
        borderColor: 'divider',
        borderRadius: appearance === 'plain' ? 0 : 3,
        overflow: 'hidden',
        bgcolor: appearance === 'plain' ? 'transparent' : 'rgba(13,21,40,.72)',
      }}
    >
      <Stack
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          p: appearance === 'plain' ? 0 : 2,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: appearance === 'plain' ? 'background.default' : 'rgba(16,24,44,.96)',
          backdropFilter: 'blur(12px)',
        }}
        spacing={1}
      >
        <Typography variant="h3" component={headingComponent}>
          {title}
        </Typography>
        {controls}
      </Stack>
      <Box
        ref={body}
        data-collection-body
        role="region"
        tabIndex={0}
        aria-label={`${title} records`}
        onKeyDown={onKeyDown}
        sx={{
          maxHeight: { xs: 'none', md: maxHeight },
          overflowY: { xs: 'visible', md: 'auto' },
          overscrollBehavior: 'contain',
          p: 2,
        }}
      >
        {empty ? (
          <Typography color="text.secondary">
            No records match this view. Adjust the filters or return when the owning workflow
            creates one.
          </Typography>
        ) : (
          children
        )}
      </Box>
      {footer && (
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            zIndex: 2,
            p: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(16,24,44,.96)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {footer}
        </Box>
      )}
    </Box>
  );
}

export function CompareTray({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children?: ReactNode;
}) {
  if (!count) return null;
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      aria-live="polite"
      sx={{
        position: 'sticky',
        bottom: 12,
        zIndex: 4,
        gap: 1,
        alignItems: { sm: 'center' },
        p: 1.5,
        borderRadius: 3,
        bgcolor: 'background.paper',
        boxShadow: 8,
      }}
    >
      <Typography sx={{ flex: 1, fontWeight: 750 }}>
        {count} {count === 1 ? 'item' : 'items'} selected for comparison
      </Typography>
      {children}
      <Button onClick={onClear}>Clear comparison</Button>
    </Stack>
  );
}
