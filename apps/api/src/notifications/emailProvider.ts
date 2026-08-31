import type { Logger } from 'pino';
import type { AppEnv } from '../config/env.js';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  sensitive?: boolean;
};
export interface EmailProvider {
  readonly name: 'CONSOLE' | 'SMTP' | 'EXTERNAL';
  send(message: EmailMessage): Promise<{ accepted: boolean; providerMessageId?: string }>;
}

export function createEmailProvider(env: AppEnv, logger: Logger): EmailProvider {
  if (env.EMAIL_PROVIDER !== 'CONSOLE')
    throw new Error(
      `${env.EMAIL_PROVIDER} email is selected but its production adapter is not installed; refusing silent delivery`,
    );
  return {
    name: 'CONSOLE',
    async send(message) {
      logger.info(
        { to: message.to, subject: message.subject, sensitive: message.sensitive ?? false },
        'Development email captured by console provider',
      );
      return { accepted: true };
    },
  };
}

export function createPasswordResetNotifier(provider: EmailProvider) {
  return async (message: { email: string; resetUrl: string; expiresAt: Date }) => {
    const result = await provider.send({
      to: message.email,
      subject: 'Reset your Credit Strategy Platform password',
      text: `Use this link before ${message.expiresAt.toISOString()}: ${message.resetUrl}`,
      sensitive: true,
    });
    if (!result.accepted) throw new Error('Password reset email was not accepted for delivery');
  };
}
