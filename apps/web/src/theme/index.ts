import { alpha, createTheme } from '@mui/material/styles';
import { designTokens, reducedMotionStyles } from './designTokens';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: designTokens.accent.main,
      light: designTokens.accent.hover,
      dark: designTokens.accent.dark,
    },
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
      fontSize: 'clamp(1.75rem, 2.5vw, 2.25rem)',
      lineHeight: 1.2,
      fontWeight: 750,
      letterSpacing: '-0.045em',
    },
    h2: {
      fontSize: 'clamp(1.4rem, 2vw, 1.75rem)',
      lineHeight: 1.25,
      fontWeight: 720,
      letterSpacing: '-0.035em',
    },
    h3: { fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontSize: '1.1rem', fontWeight: 700 },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.5 },
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
        '*:focus-visible:not(input):not(textarea):not(select):not([contenteditable="true"])': {
          outline: `${designTokens.focus.width}px solid ${alpha(designTokens.accent.main, 0.9)} !important`,
          outlineOffset: `${designTokens.focus.offset}px !important`,
        },
        ':where(input, textarea, select):focus-visible:not(.MuiInputBase-input):not(.MuiSelect-select)':
          {
            outline: `${designTokens.focus.width}px solid ${alpha(designTokens.accent.main, 0.9)}`,
            outlineOffset: designTokens.focus.offset,
          },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': reducedMotionStyles['@media (prefers-reduced-motion: reduce)'],
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: designTokens.radius.md,
          minHeight: designTokens.size.touchTarget,
          paddingInline: 20,
          transition: `transform ${designTokens.motion.fast} ${designTokens.motion.easing}, box-shadow ${designTokens.motion.standard} ${designTokens.motion.easing}`,
        },
      },
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            color: designTokens.accent.text,
            backgroundImage: designTokens.gradient.brand,
            '&:hover': { boxShadow: designTokens.shadow.glow },
            '&.Mui-disabled': {
              color: designTokens.accent.text,
              WebkitTextFillColor: designTokens.accent.text,
              backgroundImage: designTokens.gradient.brandDisabled,
              boxShadow: 'none',
              opacity: 1,
              '& .MuiButton-startIcon': { color: designTokens.accent.text, opacity: 1 },
            },
          },
        },
      ],
    },
    MuiIconButton: {
      styleOverrides: {
        root: { minWidth: designTokens.size.touchTarget, minHeight: designTokens.size.touchTarget },
      },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: designTokens.accent.main,
            borderWidth: designTokens.focus.width,
          },
          '&.Mui-focused.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: designTokens.color.coral,
          },
        },
        input: {
          '&:focus-visible': { outline: 'none' },
        },
      },
    },
    MuiFormHelperText: { styleOverrides: { root: { marginInline: 0 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: designTokens.color.skeleton } },
    },
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
