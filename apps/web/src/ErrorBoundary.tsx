import { Alert, Button, Container } from '@mui/material';
import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failure', error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <Container sx={{ py: 8 }}>
        <Alert severity="error" action={<Button onClick={() => location.reload()}>Reload</Button>}>
          The application could not be displayed.
        </Alert>
      </Container>
    ) : (
      this.props.children
    );
  }
}
