import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
// Ephemeral navigation state only; no credit data or business state is persisted.
let hubPosition = { document: 0, main: 0 };
export function rememberCreditCenterHub() {
  hubPosition = {
    document: document.scrollingElement?.scrollTop ?? 0,
    main: document.querySelector('main')?.scrollTop ?? 0,
  };
}
export function useCreditCenterHubRestore(isHub: boolean) {
  const location = useLocation();
  useEffect(() => {
    if (!isHub || !location.state?.restoreCreditCenter) return;
    const frame = requestAnimationFrame(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = hubPosition.main;
      if (document.scrollingElement) document.scrollingElement.scrollTop = hubPosition.document;
    });
    return () => cancelAnimationFrame(frame);
  }, [isHub, location.key, location.state]);
}
