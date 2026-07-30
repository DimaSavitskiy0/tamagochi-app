import nodemailer, { type Transporter } from 'nodemailer';

import { env } from './env';

export function isEmailConfigured(): boolean {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: { user: env.smtpUser, pass: env.smtpPass },
    });
  }
  return transporter;
}

// Called from POST /auth/forgot-password only when isEmailConfigured() — the route
// still succeeds without SMTP configured (the code is generated either way), it just
// has no way to deliver it, same "optional integration" pattern as lib/ai.ts.
export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  await getTransporter().sendMail({
    from: env.smtpFrom,
    to,
    subject: 'Код для сброса пароля — Тамаго',
    text: `Ваш код для сброса пароля: ${code}\n\nКод действует 15 минут. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.`,
  });
}
