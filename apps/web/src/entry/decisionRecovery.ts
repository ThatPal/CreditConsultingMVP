import { intakeResolveSchema } from '@credit/shared';
import { z } from 'zod';

const recoverySchema = intakeResolveSchema.omit({ locator: true }).extend({
  key: z.string().uuid(),
  intakeId: z.string().uuid(),
});
export type EntryDecisionRecovery = z.infer<typeof recoverySchema>;
const keyFor = (actorId: string, clientId: string, intakeId: string) =>
  `credit.entry-decision.v1:${actorId}:${clientId}:${intakeId}`;
export function readEntryDecision(actorId: string, clientId: string, intakeId: string) {
  try {
    const raw = sessionStorage.getItem(keyFor(actorId, clientId, intakeId));
    const parsed = recoverySchema.safeParse(raw ? JSON.parse(raw) : null);
    return parsed.success && parsed.data.intakeId === intakeId ? parsed.data : null;
  } catch {
    return null;
  }
}
export function writeEntryDecision(
  actorId: string,
  clientId: string,
  value: EntryDecisionRecovery,
) {
  try {
    sessionStorage.setItem(keyFor(actorId, clientId, value.intakeId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function clearEntryDecision(actorId: string, clientId: string, intakeId: string) {
  try {
    sessionStorage.removeItem(keyFor(actorId, clientId, intakeId));
  } catch {
    /* Outcome remains authoritative on server. */
  }
}
