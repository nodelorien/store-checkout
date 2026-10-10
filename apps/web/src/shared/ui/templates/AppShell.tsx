import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import SvgIcon from '@mui/material/SvgIcon';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useId, type PropsWithChildren } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { STORE_NAME } from '@/shared/config/brand';
import {
  MOTION_ALLOWED_QUERY,
  SCROLL_TIMELINE_SUPPORT,
  motion,
  useScrollProgress,
} from '@/shared/motion';

const appear = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

/** The mark: an open orbit with a point of light, in the brand gradient. */
function BrandMark() {
  const theme = useTheme();
  const gradientId = useId();

  return (
    <SvgIcon viewBox="0 0 32 32" sx={{ fontSize: 30 }} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.palette.primary.main} />
          <stop offset="1" stopColor={theme.palette.secondary.main} />
        </linearGradient>
      </defs>
      <path
        d="M16 5a11 11 0 1 0 11 11"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="24.300" cy="7.700" r="2.900" fill={theme.palette.text.primary} />
    </SvgIcon>
  );
}

/** Page frame shared by every route: brand bar, centred main column and footer. */
export function AppShell({ children }: PropsWithChildren) {
  const bar = useScrollProgress<HTMLElement>('--bar-shadow', motion.parallax.barRange);

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <AppBar
        ref={bar.ref}
        position="sticky"
        elevation={0}
        color="transparent"
        data-scroll-shadow={bar.mode}
        sx={(theme) => ({
          color: 'text.primary',
          bgcolor: alpha(theme.palette.background.default, 0.78),
          backdropFilter: 'saturate(160%) blur(14px)',
          borderBottom: `1px solid ${theme.palette.divider}`,
          // The shadow lives on a pseudo-element so only its opacity changes while scrolling.
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, 0.55)}`,
            opacity: 'var(--bar-shadow, 0)',
            [MOTION_ALLOWED_QUERY]: {
              [SCROLL_TIMELINE_SUPPORT]: {
                animation: `${appear} 1ms ${motion.easing.linear} both`,
                animationTimeline: 'scroll(root block)',
                animationRange: `0px ${motion.parallax.barRange}px`,
              },
            },
          },
        })}
      >
        <Container maxWidth="lg" disableGutters>
          <Toolbar sx={{ gap: 1, px: { xs: 2, sm: 3 }, minHeight: { xs: 56, sm: 64 } }}>
            <Link
              component={RouterLink}
              to="/"
              color="inherit"
              underline="none"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 0,
                minHeight: 44,
                borderRadius: 1,
              }}
            >
              <BrandMark />
              <Typography variant="h6" component="h1" noWrap>
                {STORE_NAME}
              </Typography>
            </Link>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{
                ml: 'auto',
                alignItems: 'center',
                flexShrink: 0,
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                border: 1,
                borderColor: 'divider',
                color: 'text.secondary',
              }}
            >
              <LockOutlinedIcon fontSize="small" aria-hidden />
              <Typography
                variant="body2"
                component="span"
                sx={{ '@media (max-width: 359.95px)': { display: 'none' } }}
              >
                Secure checkout
              </Typography>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Container
        component="main"
        maxWidth="lg"
        sx={{ flex: 1, minWidth: 0, px: { xs: 2, sm: 3 }, py: { xs: 3, md: 5 } }}
      >
        {children}
      </Container>

      <Box
        component="footer"
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          px: 2,
          pt: 2,
          pb: 'calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        <Typography variant="body2" color="text.secondary" align="center">
          {STORE_NAME} · Payments are processed securely. We never store your card.
        </Typography>
      </Box>
    </Box>
  );
}
