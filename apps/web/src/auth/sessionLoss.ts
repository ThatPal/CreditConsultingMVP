export type SessionLossListener = () => void;

const listeners = new Set<SessionLossListener>();

export function subscribeToSessionLoss(listener: SessionLossListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function signalSessionLoss() {
  for (const listener of listeners) listener();
}
