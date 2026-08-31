import { alpha, createTheme } from '@mui/material/styles';
import { designTokens, reducedMotionStyles } from './designTokens';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: designTokens.color.cyan, light: '#8deafd', dark: '#1598b6' },
    secondary: { main: designTokens.color.violet },
    success: { main: designTokens.color.teal },
    warning: { main: designTokens.color.amber },
    error: { main: designTokens.color.coral },
    background: { default: designTokens.color.canvas, paper: designTokens.color.surface },
    text: { primary: designTokens.color.textPrimary, secondary: designTokens.color.textSecondary },
    divider: designTokens.color.border,
  },
  shape: { borderRadius: designTokens.radius.md },
  spacing: 8,
  typography: {
    fontFamily: designTokens.typography.fontFamily,
    h1: {
      fontSize: 'clamp(2rem, 4vw, 3.4rem)',
      lineHeight: 1.05,
      fontWeight: 750,
      letterSpacing: '-0.045em',
    },
    h2: {
      fontSize: 'clamp(1.65rem, 3vw, 2.35rem)',
      lineHeight: 1.12,
      fontWeight: 720,
      letterSpacing: '-0.035em',
    },
    h3: { fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontSize: '1.1rem', fontWeight: 700 },
    button: { fontWeight: 700, textTransform: 'none', letterSpacing: '-0.01em' },
    overline: { fontWeight: 800, letterSpacing: '0.13em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': { colorScheme: 'dark' },
        'html, body, #root': { minHeight: '100%' },
        body: {
          backgroundColor: designTokens.color.canvas,
          backgroundImage: designTokens.gradient.ambient,
          backgroundAttachment: 'fixed',
        },
        '*': { boxSizing: 'border-box' },
        '*:focus-visible': {
          outline: `${designTokens.focus.width}px solid ${alpha(designTokens.color.cyan, 0.9)} !important`,
          outlineOffset: `${designTokens.focus.offset}px !important`,
        },
        ...reducedMotionStyles,
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: designTokens.radius.pill,
          minHeight: 42,
          paddingInline: 20,
          transition: `transform ${designTokens.motion.fast} ${designTokens.motion.easing}, box-shadow ${designTokens.motion.standard} ${designTokens.motion.easing}`,
        },
      },
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            color: '#07121a',
            backgroundImage: designTokens.gradient.brand,
            '&:hover': { transform: 'translateY(-1px)', boxShadow: designTokens.shadow.glow },
            '&.Mui-disabled': {
              color: '#07121a',
              WebkitTextFillColor: '#07121a',
              backgroundImage: designTokens.gradient.brandDisabled,
              boxShadow: 'none',
              opacity: 1,
              '& .MuiButton-startIcon': { color: '#07121a', opacity: 1 },
            },
          },
        },
      ],
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiFormHelperText: { styleOverrides: { root: { marginInline: 0 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: designTokens.color.surfaceOverlay,
          border: `1px solid ${designTokens.color.border}`,
          boxShadow: designTokens.shadow.elevated,
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 700, borderRadius: designTokens.radius.pill } },
    },
  },
});

export { designTokens } from './designTokens';
