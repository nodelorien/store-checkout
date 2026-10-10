import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import type { SxProps, Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useCallback, useState } from 'react';
import { ParallaxLayer, clipWithoutScrolling } from '@/shared/motion';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  /** Intrinsic size; only the ratio matters (the image always fills its container's width). */
  width?: number;
  height?: number;
  /** `high`: above the fold and likely the largest paint. `eager`: above the fold. */
  priority?: 'high' | 'eager' | 'lazy';
  /**
   * Pixels the image drifts inside its frame while it crosses the viewport. The image overfills
   * the frame by the same margin, so the frame never shows an empty band.
   */
  parallax?: number;
  sx?: SxProps<Theme>;
}

type Status = 'loading' | 'loaded' | 'error';

/**
 * Image in a fixed-ratio box, so the layout never shifts and nothing can overflow: skeleton while
 * loading, placeholder on error, lazy by default.
 */
export function ResponsiveImage({
  src,
  alt,
  width = 800,
  height = 600,
  priority = 'lazy',
  parallax = 0,
  sx,
}: ResponsiveImageProps) {
  const [status, setStatus] = useState<Status>(src ? 'loading' : 'error');

  // A cached image can finish before React attaches `onLoad`; check on mount.
  const handleRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setStatus('loaded');
  }, []);

  const image = (
    <Box
      component="img"
      ref={handleRef}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority === 'lazy' ? 'lazy' : 'eager'}
      decoding="async"
      fetchPriority={priority === 'high' ? 'high' : 'auto'}
      onLoad={() => setStatus('loaded')}
      onError={() => setStatus('error')}
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: status === 'loaded' ? 1 : 0,
        transition: (theme) =>
          theme.transitions.create(['opacity', 'transform'], {
            duration: theme.transitions.duration.standard,
          }),
      }}
    />
  );

  return (
    <Box
      sx={[
        {
          position: 'relative',
          width: '100%',
          aspectRatio: `${width} / ${height}`,
          ...clipWithoutScrolling,
          bgcolor: 'action.hover',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {status === 'loading' && (
        <Skeleton
          variant="rectangular"
          animation="wave"
          data-testid="image-skeleton"
          sx={{ position: 'absolute', inset: 0, height: '100%' }}
        />
      )}

      {status === 'error' ? (
        <Stack
          role="img"
          aria-label={alt}
          spacing={0.5}
          sx={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.secondary',
          }}
        >
          <ImageNotSupportedOutlinedIcon aria-hidden />
          <Typography variant="body2">Image unavailable</Typography>
        </Stack>
      ) : parallax > 0 ? (
        <ParallaxLayer
          travel={parallax}
          data-testid="image-parallax"
          sx={{ position: 'absolute', inset: `${-parallax}px 0` }}
        >
          {image}
        </ParallaxLayer>
      ) : (
        image
      )}
    </Box>
  );
}
