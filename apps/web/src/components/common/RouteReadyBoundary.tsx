import { Alert, Button, Stack, Typography } from '@mui/material';
import { Component, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LoadingSkeleton } from './Feedback';

export type RouteReadyCopy = {
  label: string;
  home: string;
  homeLabel: string;
};

export function routeReadyCopy(pathname: string): RouteReadyCopy {
  if (pathname.startsWith('/crm')) return { label: 'CRM workspace', home: '/crm', homeLabel: 'Return to CRM home' };
  if (pathname.startsWith('/admin')) return { label: 'Admin workspace', home: '/admin', homeLabel: 'Return to Admin home' };
  return { label: 'client portal page', home: '/app', homeLabel: 'Return to portal home' };
}

function RouteLoading({ copy }: { copy: RouteReadyCopy }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8_000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <Stack spacing={2} role="status" aria-live="polite">
      <Typography variant="h2">Loading {copy.label}</Typography>
      <Typography color="text.secondary">
        {slow
          ? `This ${copy.label} is taking longer than expected. No submitted or saved state was changed.`
          : `Preparing this ${copy.label}.`}
      </Typography>
      <LoadingSkeleton label={`Loading ${copy.label}`} />
      {slow && <Button component={Link} to={copy.home}>{copy.homeLabel}</Button>}
    </Stack>
  );
}

class RouteRenderBoundary extends Component<
  { children: ReactNode; copy: RouteReadyCopy },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    // Deliberately bounded telemetry: never include URL/query data, component props,
    // response bodies, or credential-bearing values in route failure evidence.
    console.error('Route render failure', { event: 'route_render_failure', routeFamily: this.props.copy.label, errorName: error.name });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Alert severity="error">
        <Typography sx={{ fontWeight: 850 }}>{this.props.copy.label} couldn’t be loaded</Typography>
        <Typography>No submitted or saved state was changed. Retry this page or return to a known location.</Typography>
        <Stack direction="row" sx={{ gap: 1, mt: 1 }}>
          <Button size="small" onClick={() => location.reload()}>Retry page</Button>
          <Button size="small" component={Link} to={this.props.copy.home}>{this.props.copy.homeLabel}</Button>
        </Stack>
      </Alert>
    );
  }
}

export function RouteReadyBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const copy = routeReadyCopy(location.pathname);
  return (
    <RouteRenderBoundary key={location.pathname} copy={copy}>
      <Suspense fallback={<RouteLoading copy={copy} />}>{children}</Suspense>
    </RouteRenderBoundary>
  );
}
