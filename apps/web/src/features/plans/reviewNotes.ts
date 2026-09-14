import { useEffect, useState } from 'react';
export const reviewNotesPrefix = 'astra:plan-review-notes:v1:';
export const reviewNotesKey = (actorId: string, clientId: string, planId: string) =>
  `${reviewNotesPrefix}${encodeURIComponent(actorId)}:${encodeURIComponent(clientId)}:${encodeURIComponent(planId)}`;
export type ReviewNote = {
  text: string;
  title: string;
  evidenceId: string | null;
  updatedAt: number;
};
type Notes = Record<string, ReviewNote>;
function read(key?: string): { notes: Notes; failed: boolean } {
  if (!key) return { notes: {}, failed: false };
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { notes: {}, failed: false };
    const parsed = JSON.parse(raw);
    if (parsed.format !== 1 || !parsed.notes || typeof parsed.notes !== 'object')
      return { notes: {}, failed: true };
    const notes: Notes = {};
    for (const [id, value] of Object.entries(parsed.notes).slice(0, 200)) {
      const note = value as ReviewNote;
      if (
        note &&
        typeof note.text === 'string' &&
        note.text.length <= 2000 &&
        typeof note.title === 'string' &&
        note.title.length <= 160 &&
        (note.evidenceId === null || typeof note.evidenceId === 'string') &&
        Number.isFinite(note.updatedAt) &&
        note.updatedAt <= Date.now() &&
        Date.now() - note.updatedAt < 86400000
      )
        notes[id] = note;
    }
    return { notes, failed: false };
  } catch {
    return { notes: {}, failed: true };
  }
}
export function useReviewNotes(key?: string) {
  const [state, setState] = useState(() => ({ scope: key, ...read(key) }));
  const notes = state.scope === key ? state.notes : {};
  useEffect(() => {
    if (state.scope !== key) setState({ scope: key, ...read(key) });
  }, [key, state.scope]);
  useEffect(() => {
    if (!key || state.scope !== key) return;
    try {
      if (Object.keys(state.notes).length)
        sessionStorage.setItem(key, JSON.stringify({ format: 1, notes: state.notes }));
      else if (!state.failed) sessionStorage.removeItem(key);
    } catch {
      if (!state.failed) setState((current) => ({ ...current, failed: true }));
    }
  }, [key, state]);
  const put = (id: string, note: ReviewNote | null) =>
    setState((current) => {
      const next = { ...(current.scope === key ? current.notes : {}) };
      if (note?.text.trim()) next[id] = note;
      else delete next[id];
      return { scope: key, notes: next, failed: current.failed };
    });
  return { notes, put, failed: state.scope === key && state.failed };
}
