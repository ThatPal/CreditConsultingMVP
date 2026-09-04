import type { Pool } from 'pg';

export interface WorkerEmailSender {
  readonly provider: 'CONSOLE' | 'SMTP' | 'EXTERNAL';
  send(message: {
    to: string;
    subject: string;
    text: string;
  }): Promise<{ accepted: boolean; providerMessageId?: string }>;
}

export const NOTIFICATION_MAX_ATTEMPTS = 5;
export function notificationRetryDelaySeconds(attempt: number) {
  return Math.min(15 * 60, 5 * 2 ** Math.max(0, attempt - 1));
}

export function createNotificationDeliveryProcessor(pool: Pool, sender: WorkerEmailSender) {
  return async (deliveryId: string) => {
    const result = await pool.query<{
      id: string;
      status: string;
      provider: string;
      attemptCount: number;
      email: string;
      title: string;
      body: string;
    }>(
      `SELECT d.id, d.status, d.provider, d."attemptCount", u.email, n.title, n.body
       FROM "NotificationDelivery" d
       JOIN "Notification" n ON n.id = d."notificationId"
       JOIN "User" u ON u.id = n."userId"
       WHERE d.id = $1`,
      [deliveryId],
    );
    const delivery = result.rows[0];
    if (!delivery) throw new Error('NOTIFICATION_DELIVERY_NOT_FOUND');
    if (delivery.status === 'DELIVERED') return;
    if (delivery.status === 'FAILED') throw new Error('NOTIFICATION_DELIVERY_TERMINAL');
    if (delivery.provider !== sender.provider) throw new Error('EMAIL_PROVIDER_MISMATCH');
    const claim = await pool.query(
      `UPDATE "NotificationDelivery"
       SET status = 'PROCESSING', "attemptCount" = "attemptCount" + 1, "lastAttemptAt" = now(), "updatedAt" = now()
       WHERE id = $1 AND (
         (status IN ('PENDING', 'RETRY_SCHEDULED') AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= now()))
         OR (status = 'PROCESSING' AND "lastAttemptAt" < now() - interval '5 minutes')
       )
       RETURNING id`,
      [delivery.id],
    );
    if (claim.rowCount !== 1) return;
    try {
      const sent = await sender.send({
        to: delivery.email,
        subject: delivery.title,
        text: delivery.body,
      });
      if (!sent.accepted) throw new Error('PROVIDER_REJECTED');
      await pool.query(
        `UPDATE "NotificationDelivery"
         SET status = 'DELIVERED', "providerMessageId" = $2, "deliveredAt" = now(),
             "failureCategory" = NULL, "nextAttemptAt" = NULL, "updatedAt" = now()
         WHERE id = $1`,
        [delivery.id, sent.providerMessageId ?? null],
      );
    } catch (error) {
      const attempt = delivery.attemptCount + 1;
      const terminal = attempt >= NOTIFICATION_MAX_ATTEMPTS;
      const delaySeconds = notificationRetryDelaySeconds(attempt);
      await pool.query(
        `UPDATE "NotificationDelivery"
         SET status = $2::"NotificationDeliveryStatus", "failureCategory" = 'PROVIDER_UNAVAILABLE',
             "nextAttemptAt" = CASE WHEN $2 = 'FAILED' THEN NULL ELSE now() + make_interval(secs => $3) END,
             "updatedAt" = now()
         WHERE id = $1`,
        [delivery.id, terminal ? 'FAILED' : 'RETRY_SCHEDULED', delaySeconds],
      );
      throw error;
    }
  };
}
