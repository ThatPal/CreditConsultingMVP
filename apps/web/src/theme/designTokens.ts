export const designTokens = {
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    weight: { regular: 400, medium: 600, strong: 700, emphasis: 800 },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  color: {
    canvas: '#070b18',
    canvasRaised: '#0b1124',
    sidebar: 'rgba(10, 16, 34, 0.92)',
    topbar: 'rgba(7, 11, 24, 0.78)',
    surface: '#10182c',
    surfaceElevated: '#15203a',
    surfaceOperational: '#0d1528',
    surfaceOverlay: '#19233b',
    border: 'rgba(148, 163, 184, 0.16)',
    borderStrong: 'rgba(103, 232, 249, 0.32)',
    textPrimary: '#f4f7ff',
    textSecondary: '#a9b7d1',
    textMuted: '#74829f',
    cyan: '#42d3f2',
    blue: '#5b8cff',
    violet: '#9b78ff',
    teal: '#36d3ae',
    amber: '#f6b84b',
    coral: '#ff6f7d',
    focusSurface: '#f2f4ed',
    focusSurfacePositive: '#e9f5ed',
    focusText: '#18231f',
    focusTextMuted: '#53635d',
    focusBorder: '#cad8cf',
    focusAccent: '#087f65',
  },
  gradient: {
    brand: 'linear-gradient(135deg, #5b8cff 0%, #42d3f2 46%, #9b78ff 100%)',
    brandDisabled: 'linear-gradient(135deg, #788fca 0%, #78b9c8 46%, #9b8ac7 100%)',
    subtle: 'linear-gradient(145deg, rgba(66, 211, 242, 0.12), rgba(155, 120, 255, 0.08))',
    active: 'linear-gradient(90deg, rgba(66, 211, 242, 0.18), rgba(91, 140, 255, 0.08))',
    ambient:
      'radial-gradient(circle at 14% 6%, rgba(66, 211, 242, 0.10), transparent 28%), radial-gradient(circle at 85% 16%, rgba(155, 120, 255, 0.08), transparent 26%)',
  },
  radius: { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 },
  shadow: {
    card: '0 16px 40px rgba(0, 0, 0, 0.22)',
    elevated: '0 22px 70px rgba(0, 0, 0, 0.34)',
    glow: '0 0 0 1px rgba(66, 211, 242, 0.18), 0 16px 44px rgba(45, 151, 210, 0.12)',
  },
  motion: {
    fast: '150ms',
    standard: '220ms',
    slow: '360ms',
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  focus: {
    width: 3,
    offset: 3,
  },
} as const;

export const reducedMotionStyles = {
  '@media (prefers-reduced-motion: reduce)': {
    animationDuration: '0.01ms !important',
    animationIterationCount: '1 !important',
    scrollBehavior: 'auto !important',
    transitionDuration: '0.01ms !important',
  },
};
