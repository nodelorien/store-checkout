import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { ParallaxLayer, Reveal, motion } from '@/shared/motion';

const FAR_TRAVEL = motion.parallax.maxTravel;
const NEAR_TRAVEL = motion.parallax.maxTravel / 2;

/** A layer that overfills the band by its own travel, so drifting never uncovers an edge. */
const layerSx = (travel: number) =>
  ({ position: 'absolute', inset: `${-travel}px 0`, pointerEvents: 'none' }) as const;

/** Far layer: large, soft discs of light. */
function FarShapes() {
  return (
    <>
      <Box
        sx={(theme) => ({
          position: 'absolute',
          top: '-18%',
          right: '-14%',
          width: { xs: 220, md: 340 },
          aspectRatio: '1',
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.primary.light, 0.5),
        })}
      />
      <Box
        sx={(theme) => ({
          position: 'absolute',
          bottom: '-34%',
          left: '-10%',
          width: { xs: 180, md: 280 },
          aspectRatio: '1',
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.common.white, 0.07),
        })}
      />
    </>
  );
}

/** Near layer: the brand's sun and a few sparks, closer to the viewer. */
function NearShapes() {
  return (
    <Box
      component="svg"
      viewBox="0 0 400 240"
      preserveAspectRatio="xMaxYMid slice"
      focusable="false"
      sx={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        color: 'secondary.main',
      }}
    >
      <circle cx="318" cy="92" r="26" fill="currentColor" />
      <path
        d="M318 44v14M318 126v14M270 92h14M352 92h14M284 58l10 10M342 116l10 10M284 126l10-10M342 68l10-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="232" cy="52" r="4" fill="currentColor" opacity="0.7" />
      <circle cx="372" cy="176" r="6" fill="currentColor" opacity="0.5" />
      <circle cx="252" cy="196" r="3" fill="currentColor" opacity="0.8" />
      <circle cx="196" cy="118" r="2.5" fill="currentColor" opacity="0.6" />
    </Box>
  );
}

/**
 * Hero band of the store. Three planes — far shapes, near shapes, text — drift at different
 * speeds while the page scrolls. The band's size never depends on the scroll position.
 */
export function StoreHero() {
  const titleId = useId();

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={(theme) => ({
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        minHeight: { xs: 176, md: 232 },
        p: { xs: 2.5, md: 4 },
        borderRadius: 2,
        color: 'primary.contrastText',
        backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
      })}
    >
      <ParallaxLayer
        aria-hidden
        timeline="scroll"
        travel={FAR_TRAVEL}
        data-testid="hero-layer-far"
        sx={[layerSx(FAR_TRAVEL), { zIndex: -2 }]}
      >
        <FarShapes />
      </ParallaxLayer>
      <ParallaxLayer
        aria-hidden
        timeline="scroll"
        travel={NEAR_TRAVEL}
        data-testid="hero-layer-near"
        sx={[layerSx(NEAR_TRAVEL), { zIndex: -1 }]}
      >
        <NearShapes />
      </ParallaxLayer>

      <Reveal sx={{ minWidth: 0, maxWidth: { xs: '72%', sm: 520 } }}>
        <Stack spacing={0.75}>
          <Typography id={titleId} variant="h1" component="h2">
            Featured products
          </Typography>
          <Typography sx={{ opacity: 0.9 }}>
            Hand-picked essentials, delivered to your door.
          </Typography>
        </Stack>
      </Reveal>
    </Box>
  );
}
