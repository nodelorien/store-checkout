import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import SvgIcon from '@mui/material/SvgIcon';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { PropsWithChildren } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { STORE_NAME } from '@/shared/config/brand';

function BrandMark() {
  return (
    <SvgIcon viewBox="0 0 24 24" sx={{ color: 'secondary.main', fontSize: 28 }} aria-hidden>
      <circle cx="12" cy="12" r="5" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}

/** Page frame shared by every route: brand bar, centred main column and footer. */
export function AppShell({ children }: PropsWithChildren) {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <AppBar position="sticky" elevation={0} color="primary">
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
              sx={{ ml: 'auto', alignItems: 'center', flexShrink: 0, opacity: 0.9 }}
            >
              <LockOutlinedIcon fontSize="small" aria-hidden />
              <Typography variant="body2" component="span">
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
