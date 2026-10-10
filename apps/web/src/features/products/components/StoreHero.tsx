import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha, keyframes } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import {
  MOTION_ALLOWED_QUERY,
  ParallaxLayer,
  Reveal,
  motion,
  usePointerDepth,
} from '@/shared/motion';

const FAR_TRAVEL = motion.parallax.maxTravel;
const NEAR_TRAVEL = motion.parallax.maxTravel / 2;
/** Pixels each plane leans towards the mouse; nearer planes lean more. */
const FAR_POINTER = 10;
const NEAR_POINTER = 26;

const bloom = keyframes({ from: { opacity: 0, transform: 'scale(0.7) rotate(-24deg)' } });
const twinkle = keyframes({ from: { opacity: 0, transform: 'scale(0)' } });

/** Opening sequence: plays once per page load, from the keyframe to the element's resting state. */
const intro = (name: typeof bloom, delay: number, easing: string = motion.easing.decelerate) => ({
  [MOTION_ALLOWED_QUERY]: {
    animation: `${name} ${motion.duration.intro}ms ${easing} ${delay}ms backwards`,
  },
});

/** A layer that overfills the band by its own travel, so drifting never uncovers an edge. */
const layerSx = (travel: number) =>
  ({ position: 'absolute', inset: `${-travel}px 0`, pointerEvents: 'none' }) as const;

/** A flat ring: a gradient disc with its centre masked out. */
const ring = (thickness: { xs: number; md: number }) => {
  const mask = (px: number) =>
    `radial-gradient(farthest-side, transparent calc(100% - ${px}px), black calc(100% - ${px - 1}px))`;

  return {
    position: 'absolute',
    aspectRatio: '1',
    borderRadius: '50%',
    WebkitMaskImage: { xs: mask(thickness.xs), md: mask(thickness.md) },
    maskImage: { xs: mask(thickness.xs), md: mask(thickness.md) },
  } as const;
};

/** Far plane: one large arc entering from the top right. */
function FarShapes() {
  return (
    <Box
      sx={(theme) => ({
        ...ring({ xs: 46, md: 84 }),
        top: { xs: '-34%', md: '-52%' },
        right: { xs: '-26%', md: '-6%' },
        width: { xs: 300, md: 560 },
        backgroundImage: `linear-gradient(200deg, ${theme.palette.secondary.main}, ${theme.palette.primary.dark} 70%)`,
        opacity: 0.95,
        ...intro(bloom, 0),
      })}
    />
  );
}

/** Near plane: a smaller arc from the left edge and a point of light. */
function NearShapes() {
  return (
    <>
      <Box
        sx={(theme) => ({
          ...ring({ xs: 30, md: 52 }),
          top: { xs: '18%', md: '8%' },
          left: { xs: '-24%', md: '47%' },
          width: { xs: 190, md: 300 },
          backgroundImage: `linear-gradient(20deg, ${alpha(theme.palette.primary.main, 0.1)}, ${theme.palette.secondary.main})`,
          opacity: { xs: 0.5, md: 0.6 },
          ...intro(bloom, 140),
        })}
      />
      <Box
        sx={(theme) => ({
          position: 'absolute',
          top: { xs: '30%', md: '34%' },
          right: { xs: '16%', md: '24%' },
          width: { xs: 12, md: 16 },
          aspectRatio: '1',
          borderRadius: '50%',
          bgcolor: 'common.white',
          boxShadow: `0 0 0 6px ${alpha(theme.palette.common.white, 0.12)}, 0 0 28px ${theme.palette.secondary.main}`,
          ...intro(twinkle, 520, motion.easing.spring),
        })}
      />
    </>
  );
}

/**
 * Hero band of the store. Three planes — far shapes, near shapes, text — drift at different
 * speeds while the page scrolls and lean towards the mouse. The band's size never depends on
 * either.
 */
export function StoreHero() {
  const titleId = useId();
  const depth = usePointerDepth<HTMLElement>();

  return (
    <Box
      ref={depth.ref}
      component="section"
      aria-labelledby={titleId}
      {...depth.handlers}
      sx={(theme) => ({
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        minHeight: { xs: 248, sm: 280, md: 360 },
        p: { xs: 2.5, md: 5 },
        borderRadius: '24px',
        border: `1px solid ${theme.palette.divider}`,
        color: 'text.primary',
        backgroundImage: theme.brand.panel,
      })}
    >
      <ParallaxLayer
        aria-hidden
        timeline="scroll"
        travel={FAR_TRAVEL}
        pointer={FAR_POINTER}
        data-testid="hero-layer-far"
        sx={[layerSx(FAR_TRAVEL), { zIndex: -2 }]}
      >
        <FarShapes />
      </ParallaxLayer>
      <ParallaxLayer
        aria-hidden
        timeline="scroll"
        travel={NEAR_TRAVEL}
        pointer={NEAR_POINTER}
        data-testid="hero-layer-near"
        sx={[layerSx(NEAR_TRAVEL), { zIndex: -1 }]}
      >
        <NearShapes />
      </ParallaxLayer>

      <Reveal sx={{ minWidth: 0, maxWidth: { xs: '86%', sm: 560 } }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2" component="p" color="primary.light">
            The Lumen collection
          </Typography>
          <Typography id={titleId} variant="h1" component="h2" sx={{ fontSize: { md: '3.25rem' } }}>
            Featured products
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: { md: '1.125rem' } }}>
            Hand-picked essentials, delivered to your door.
          </Typography>
        </Stack>
      </Reveal>
    </Box>
  );
}
