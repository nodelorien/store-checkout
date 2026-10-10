import { alpha, createTheme } from '@mui/material/styles';

/** Brand tokens. Hex values live only in this file; components use `theme.palette`. */
const brand = {
  navy: '#1b3a57',
  navyDark: '#11273c',
  navyLight: '#3d5f80',
  amber: '#f2a541',
  amberDark: '#b96a09',
  ink: '#14212e',
  slate: '#4a5a6a',
  mist: '#f4f6f9',
  line: '#dfe5ec',
  white: '#ffffff',
  green: '#1b7a4b',
  red: '#b3261e',
  orange: '#a45200',
};

const TOUCH_TARGET = 48;

const base = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand.navy, dark: brand.navyDark, light: brand.navyLight },
    secondary: { main: brand.amber, dark: brand.amberDark, contrastText: brand.ink },
    success: { main: brand.green },
    error: { main: brand.red },
    warning: { main: brand.orange },
    text: { primary: brand.ink, secondary: brand.slate },
    background: { default: brand.mist, paper: brand.white },
    divider: brand.line,
  },
  shape: { borderRadius: 12 },
  transitions: {
    duration: {
      shortest: 120,
      shorter: 160,
      short: 200,
      standard: 250,
      complex: 250,
      enteringScreen: 225,
      leavingScreen: 195,
    },
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.375rem', fontWeight: 700, lineHeight: 1.25 },
    h3: { fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.3 },
    h6: { fontSize: '1.125rem', fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '1rem' },
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
        html: { WebkitTextSizeAdjust: '100%' },
        body: { overflowWrap: 'anywhere' },
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
        root: { minHeight: TOUCH_TARGET, paddingInline: base.spacing(2.5) },
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
        root: { backgroundColor: base.palette.background.paper },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginInline: base.spacing(0.5) } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${base.palette.divider}`,
          boxShadow: `0 1px 2px ${alpha(base.palette.text.primary, 0.04)}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiAlert: {
      styleOverrides: { root: { alignItems: 'center' }, message: { overflowWrap: 'anywhere' } },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: '1.25rem', fontWeight: 700 } },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: alpha(base.palette.primary.dark, 0.6) },
        invisible: { backgroundColor: 'transparent' },
      },
    },
  },
});
