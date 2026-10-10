import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Component, type PropsWithChildren } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Last line of defence: a render crash shows a way out instead of a blank page. */
export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  private readonly handleRetry = () => this.setState({ hasError: false });

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Stack
        role="alert"
        spacing={2}
        sx={{ alignItems: 'center', textAlign: 'center', px: 2, py: 8 }}
      >
        <Typography variant="h2">Something went wrong</Typography>
        <Typography color="text.secondary">
          The page could not be displayed. Your payment details were not affected.
        </Typography>
        <Button variant="contained" onClick={this.handleRetry}>
          Try again
        </Button>
      </Stack>
    );
  }
}
