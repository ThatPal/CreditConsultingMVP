import type { EmailProvider } from './emailProvider.js';

export type InAppNotificationInput = {
  userId: string;
  clientId?: string;
  type: string;
  title: string;
  body: string;
  link?: string;
};
export interface NotificationStore {
  create(input: InAppNotificationInput): Promise<{ id: string }>;
}

export class NotificationService {
  constructor(
    private readonly store: NotificationStore,
    private readonly email: EmailProvider,
  ) {}

  notifyInApp(input: InAppNotificationInput) {
    return this.store.create(input);
  }

  async sendEmail(to: string, subject: string, text: string) {
    const delivery = await this.email.send({ to, subject, text });
    if (!delivery.accepted) throw new Error('Outbound email provider rejected delivery');
    return delivery;
  }
}
