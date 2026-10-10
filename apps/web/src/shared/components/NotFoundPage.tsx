import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 8 }}>
      <Typography variant="h1" component="h2">
        Page not found
      </Typography>
      <Typography color="text.secondary">
        The page you are looking for does not exist or has moved.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Back to store
      </Button>
    </Stack>
  );
}
