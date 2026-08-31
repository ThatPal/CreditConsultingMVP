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
  testConnection?(): Promise<void>;
}

export type SmtpConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  passwordSecretRef: string;
  from: string;
};

export interface SmtpTransport {
  send(
    configuration: SmtpConfiguration,
    message: EmailMessage,
  ): Promise<{ accepted: boolean; providerMessageId?: string }>;
  testConnection(configuration: SmtpConfiguration): Promise<void>;
}

export function createEmailProvider(
  env: AppEnv,
  logger: Logger,
  adapters?: { smtp?: SmtpTransport; external?: EmailProvider },
): EmailProvider {
  if (env.EMAIL_PROVIDER === 'CONSOLE')
    return {
      name: 'CONSOLE',
      async send(message) {
        logger.info(
          { to: message.to, subject: message.subject, sensitive: message.sensitive ?? false },
          'Development email captured by console provider',
        );
        return { accepted: true };
      },
      async testConnection() {},
    };
  if (env.EMAIL_PROVIDER === 'EXTERNAL') {
    if (!adapters?.external)
      throw new Error('EXTERNAL email is selected but no adapter is installed; refusing delivery');
    return adapters.external;
  }
  if (!adapters?.smtp)
    throw new Error('SMTP email is selected but no transport is installed; refusing delivery');
  const configuration: SmtpConfiguration = {
    host: env.EMAIL_SMTP_HOST!,
    port: env.EMAIL_SMTP_PORT!,
    secure: env.EMAIL_SMTP_SECURE,
    ...(env.EMAIL_SMTP_USERNAME ? { username: env.EMAIL_SMTP_USERNAME } : {}),
    passwordSecretRef: env.EMAIL_SMTP_PASSWORD_SECRET_REF!,
    from: env.EMAIL_FROM,
  };
  return {
    name: 'SMTP',
    send: (message) => adapters.smtp!.send(configuration, message),
    testConnection: () => adapters.smtp!.testConnection(configuration),
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

export function createAuthEmailNotifier(provider: EmailProvider) {
  return {
    async verification(message: { email: string; url: string }) {
      const result = await provider.send({
        to: message.email,
        subject: 'Verify your Credit Strategy Platform email',
        text: `Verify your email: ${message.url}`,
        sensitive: true,
      });
      if (!result.accepted) throw new Error('Verification email was not accepted for delivery');
    },
    async passwordReset(message: { email: string; url: string }) {
      const result = await provider.send({
        to: message.email,
        subject: 'Reset your Credit Strategy Platform password',
        text: `Reset your password: ${message.url}`,
        sensitive: true,
      });
      if (!result.accepted) throw new Error('Password reset email was not accepted for delivery');
    },
  };
}
