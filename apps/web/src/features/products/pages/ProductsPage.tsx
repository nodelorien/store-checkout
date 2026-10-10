import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function ProductsPage() {
  return (
    <Stack spacing={1}>
      <Typography variant="h1" component="h2">
        Featured products
      </Typography>
      <Typography color="text.secondary">
        Hand-picked essentials, delivered to your door.
      </Typography>
    </Stack>
  );
}
