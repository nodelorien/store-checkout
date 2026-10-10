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

const bloom = keyframes({ from: { opacity: 0, transform: 'scale(0.6)' } });
const rise = keyframes({ from: { opacity: 0, transform: 'scale(0.4) rotate(-90deg)' } });
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

/** Far plane: large, soft discs of light. */
function FarShapes() {
  return (
    <>
      <Box
        sx={(theme) => ({
          position: 'absolute',
          top: '-12%',
          right: { xs: '-14%', md: '-4%' },
          width: { xs: 220, md: 420 },
          aspectRatio: '1',
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.primary.light, 0.5),
          ...intro(bloom, 0),
        })}
      />
      <Box
        sx={(theme) => ({
          position: 'absolute',
          bottom: '-22%',
          left: '-8%',
          width: { xs: 180, md: 300 },
          aspectRatio: '1',
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.common.white, 0.07),
          ...intro(bloom, 120),
        })}
      />
    </>
  );
}

const SPARKS = [
  { cx: 232, cy: 52, r: 4, opacity: 0.7 },
  { cx: 372, cy: 176, r: 6, opacity: 0.5 },
  { cx: 252, cy: 196, r: 3, opacity: 0.8 },
  { cx: 196, cy: 118, r: 2.5, opacity: 0.6 },
];

/** Near plane: the brand's sun and a few sparks, closer to the viewer. */
function NearShapes() {
  const centred = { transformBox: 'fill-box', transformOrigin: 'center' } as const;

  return (
    <Box
      component="svg"
      viewBox="0 0 400 240"
      // `meet` keeps the whole drawing visible, anchored to the right, at any band width.
      preserveAspectRatio="xMaxYMid meet"
      focusable="false"
      sx={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        color: 'secondary.main',
      }}
    >
      <Box component="g" sx={{ ...centred, ...intro(rise, 180, motion.easing.spring) }}>
        <circle cx="318" cy="112" r="26" fill="currentColor" />
        <path
          d="M318 64v14M318 146v14M270 112h14M352 112h14M284 78l10 10M342 136l10 10M284 146l10-10M342 88l10-10"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </Box>
      {SPARKS.map((spark, index) => (
        <Box
          key={spark.cx}
          component="circle"
          {...spark}
          fill="currentColor"
          sx={{ ...centred, ...intro(twinkle, 420 + index * 90, motion.easing.spring) }}
        />
      ))}
    </Box>
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
        minHeight: { xs: 176, sm: 240, md: 320 },
        p: { xs: 2.5, md: 5 },
        borderRadius: 2,
        color: 'primary.contrastText',
        backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
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

      <Reveal sx={{ minWidth: 0, maxWidth: { xs: '72%', sm: 520 } }}>
        <Stack spacing={0.75}>
          <Typography
            id={titleId}
            variant="h1"
            component="h2"
            sx={{ fontSize: { md: '3rem' }, letterSpacing: '-0.02em' }}
          >
            Featured products
          </Typography>
          <Typography sx={{ opacity: 0.9, fontSize: { md: '1.125rem' } }}>
            Hand-picked essentials, delivered to your door.
          </Typography>
        </Stack>
      </Reveal>
    </Box>
  );
}
