import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useLayoutEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useBlocker } from 'react-router-dom';
import { SessionEndedContext } from './auth/AuthProvider';

type PendingWork = { dirty: boolean; busy: boolean };
const PendingStatus = createContext<PendingWork>({ dirty: false, busy: false });
export const ResponseWritePause = createContext(false);
export function usePendingNavigationWork() {
  return useContext(PendingStatus);
}

const Registration = createContext<((id: string, work: PendingWork | null) => void) | null>(null);

// One router blocker aggregates every mounted response, including multi-step Plans.
export function NavigationProtection({ children }: PropsWithChildren) {
  const sessionEnded = useContext(SessionEndedContext);
  const endedRef = useRef(sessionEnded);
  useLayoutEffect(() => {
    endedRef.current = sessionEnded;
  }, [sessionEnded]);
  const [work, setWork] = useState<Record<string, PendingWork>>({});
  const register = useCallback((id: string, value: PendingWork | null) => {
    setWork((current) => {
      const next = { ...current };
      if (value) next[id] = value;
      else delete next[id];
      return next;
    });
  }, []);
  const dirty = Object.values(work).some((entry) => entry.dirty);
  const busy = Object.values(work).some((entry) => entry.busy);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !endedRef.current &&
      (dirty || busy) &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  useLayoutEffect(() => {
    if (!sessionEnded || blocker.state !== 'blocked') return;
    // Only the secure sign-in handoff may proceed; discard stale user navigation.
    if (blocker.location.pathname === '/login') blocker.proceed();
    else blocker.reset();
  }, [sessionEnded, blocker]);
  const stay = () => {
    if (blocker.state === 'blocked') blocker.reset();
  };
  return (
    <Registration.Provider value={register}>
      <PendingStatus.Provider value={{ dirty, busy }}>{children}</PendingStatus.Provider>
      <Dialog
        open={!sessionEnded && blocker.state === 'blocked'}
        onClose={stay}
        aria-labelledby="leave-response-title"
        aria-describedby="leave-response-description"
      >
        <DialogTitle id="leave-response-title">
          {dirty || busy ? 'Your response is still in progress' : 'Your changes are saved'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="leave-response-description" role="status">
            {busy
              ? 'A save, upload or submission is still running. Please wait before leaving, or stay on this page.'
              : dirty
                ? 'Your latest changes are not saved yet. If automatic saving is available, it will continue while this is open. If saving failed, stay on this page and use Save draft to retry. Leaving now keeps only your last successful save.'
                : 'You can now continue to the page you selected.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, p: 2 }}>
          <Button autoFocus variant="contained" onClick={stay}>
            Stay on this page
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              if (blocker.state === 'blocked') blocker.proceed();
            }}
          >
            {dirty ? 'Leave without latest changes' : 'Continue to page'}
          </Button>
        </DialogActions>
      </Dialog>
    </Registration.Provider>
  );
}

export function useNavigationProtection(dirty: boolean, busy: boolean) {
  const register = useContext(Registration);
  const id = useId();
  useLayoutEffect(() => {
    register?.(id, { dirty, busy });
    return () => register?.(id, null);
  }, [register, id, dirty, busy]);
}
