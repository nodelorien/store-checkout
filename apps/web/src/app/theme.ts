import { alpha, createTheme } from '@mui/material/styles';
import { motion } from '@/shared/motion/tokens';

/**
 * Brand tokens — a dark, quiet surface with one violet-to-blue accent. Hex values live only in
 * this file; components use `theme.palette` and `theme.brand`.
 */
const brand = {
  ink: '#0b0d14',
  surface: '#141724',
  raised: '#1c2030',
  line: '#2a3046',
  white: '#ffffff',
  text: '#f2f3f8',
  muted: '#a3abc2',
  violet: '#a78bfa',
  violetLight: '#c4b5fd',
  // Button fills: white text keeps a 4.5:1 contrast on both ends of the gradient.
  violetDeep: '#6d4aff',
  violetDeeper: '#5a32e6',
  blue: '#5ab0ff',
  blueDeep: '#2563c9',
  green: '#3ddc97',
  red: '#ff6b81',
  orange: '#ffb454',
};

/** Gradients and glows shared by the logo, the hero, buttons and the card preview. */
const brandEffects = {
  accent: `linear-gradient(135deg, ${brand.violet}, ${brand.blue})`,
  action: `linear-gradient(135deg, ${brand.violetDeep}, ${brand.violetDeeper})`,
  card: `linear-gradient(135deg, ${brand.violetDeeper} 0%, ${brand.violetDeep} 45%, ${brand.blueDeep} 100%)`,
  panel: `linear-gradient(160deg, ${brand.raised}, ${brand.ink})`,
  glow: `0 18px 48px ${alpha(brand.violetDeep, 0.35)}`,
};

declare module '@mui/material/styles' {
  interface Theme {
    brand: typeof brandEffects;
  }
  interface ThemeOptions {
    brand?: typeof brandEffects;
  }
}

const TOUCH_TARGET = 48;

const base = createTheme({
  brand: brandEffects,
  palette: {
    mode: 'dark',
    primary: {
      main: brand.violet,
      light: brand.violetLight,
      dark: brand.violetDeep,
      contrastText: brand.white,
    },
    secondary: { main: brand.blue, dark: brand.blueDeep, contrastText: brand.ink },
    success: { main: brand.green },
    error: { main: brand.red },
    warning: { main: brand.orange },
    info: { main: brand.blue },
    text: { primary: brand.text, secondary: brand.muted },
    background: { default: brand.ink, paper: brand.surface },
    divider: brand.line,
  },
  shape: { borderRadius: 14 },
  transitions: {
    duration: {
      shortest: 120,
      shorter: motion.duration.feedback,
      short: 200,
      standard: motion.duration.standard,
      complex: motion.duration.standard,
      enteringScreen: 225,
      leavingScreen: 195,
    },
  },
  typography: {
    fontFamily:
      '"Outfit Variable", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: '1.875rem', fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.375rem', fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.01em' },
    h3: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.3 },
    h6: { fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: {
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
    },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.01em' },
  },
});

export const theme = createTheme(base, {
  typography: {
    h1: { [base.breakpoints.up('md')]: { fontSize: '2.25rem' } },
    h2: { [base.breakpoints.up('md')]: { fontSize: '1.5rem' } },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // `colorScheme` makes native scrollbars and form controls dark as well.
        html: { WebkitTextSizeAdjust: '100%', colorScheme: 'dark' },
        body: { overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' },
        '::selection': { backgroundColor: alpha(base.palette.primary.main, 0.35) },
        // A printed receipt: no chrome, no actions, dark ink on paper.
        '@media print': {
          'header, footer, [data-print-hide]': { display: 'none !important' },
          'html, body': { backgroundColor: base.palette.common.white },
          '*': { color: `${base.palette.common.black} !important`, boxShadow: 'none !important' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: TOUCH_TARGET,
          paddingInline: base.spacing(2.5),
          borderRadius: 999,
          // Press feedback; the reduced-motion rule above makes it instant.
          transition: `transform ${motion.duration.feedback}ms ${motion.easing.standard}, background-color ${motion.duration.standard}ms`,
          '&:active': { transform: 'scale(0.97)' },
          variants: [
            {
              props: { variant: 'contained', color: 'primary' },
              style: {
                color: base.palette.common.white,
                backgroundColor: base.palette.primary.dark,
                backgroundImage: base.brand.action,
                boxShadow: `0 10px 28px ${alpha(base.palette.primary.dark, 0.38)}`,
                '&:hover': {
                  backgroundColor: base.palette.primary.dark,
                  filter: 'brightness(1.12)',
                },
                '&.Mui-disabled': { backgroundImage: 'none', boxShadow: 'none' },
              },
            },
          ],
        },
        outlined: { borderColor: base.palette.divider },
        sizeSmall: { minHeight: 44 },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { minWidth: 44, minHeight: 44 } },
    },
    MuiTextField: {
      defaultProps: { fullWidth: true, variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        // 16 px keeps iOS Safari from zooming into focused inputs.
        input: { fontSize: '1rem' },
        root: {
          backgroundColor: alpha(base.palette.common.white, 0.03),
          '& .MuiOutlinedInput-notchedOutline': { borderColor: base.palette.divider },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginInline: base.spacing(0.5) } },
    },
    MuiPaper: {
      // Dark mode tints elevated paper; surfaces here are flat and separated by hairlines.
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${base.palette.divider}`, borderRadius: 20 },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { border: `1px solid ${base.palette.divider}` } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600, letterSpacing: '0.01em' } },
    },
    MuiAlert: {
      styleOverrides: { root: { alignItems: 'center' }, message: { overflowWrap: 'anywhere' } },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: '1.25rem', fontWeight: 700 } },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(base.palette.background.default, 0.72),
          backdropFilter: 'blur(6px)',
        },
        invisible: { backgroundColor: 'transparent', backdropFilter: 'none' },
      },
    },
  },
});
