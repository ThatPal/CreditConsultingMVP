let actor: string | null = null;
let ended = false;
export function bindRequestActor(userId: string) {
  actor = userId;
  ended = false;
}
export function endRequestSession() {
  actor = null;
  ended = true;
}
export function expectedActorHeaders(path: string): Record<string, string> {
  if (
    !path.startsWith('/api/') ||
    /^\/api\/auth(?:[/?]|$)/.test(path) ||
    /^\/api\/me(?:[/?]|$)/.test(path) ||
    /^\/api\/v1\/goal-intakes(?:[/?]|$)/.test(path)
  )
    return {};
  if (ended) throw new Error('Your session changed. Sign in again before continuing.');
  return actor ? { 'X-Credit-Actor': actor } : {};
}
