import { Router } from 'express';
import { z } from 'zod';

import { isEmailConfigured, sendPasswordResetEmail } from '../lib/email';
import { BadRequest, Unauthorized } from '../lib/errors';
import {
  generateRefreshToken,
  generateResetCode,
  hashRefreshToken,
  hashResetCode,
  REFRESH_TOKEN_TTL_MS,
  RESET_CODE_TTL_MS,
  signAccessToken,
} from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// consent must be explicitly true — the sign-in screen's checkbox is unchecked by
// default and disables the register button until checked, but this is the actual
// enforcement point since a client-side disabled button is trivially bypassable.
const signUpSchema = credentialsSchema.extend({
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Нужно согласие на обработку персональных данных' }),
  }),
});

const profileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(6),
});

const pushTokenSchema = z.object({
  // Null clears the token (e.g. on sign-out from a device) — RuStore's own
  // RuStorePushClient.deleteToken() invalidates it client-side, this just stops us
  // sending to a token that no longer works.
  token: z.string().min(1).nullable(),
});

function userToJson(user: { id: string; email: string; firstName: string | null; lastName: string | null; phone: string | null }) {
  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone };
}

async function issueTokens(userId: string) {
  const accessToken = signAccessToken(userId);
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return { accessToken, refreshToken };
}

// Name/phone are collected right after by the "Добро пожаловать" onboarding flow (see
// contexts/AuthProvider.tsx), not here — mirrors the previous Supabase sign-up shape,
// which also only took email/password.
authRouter.post(
  '/sign-up',
  asyncHandler(async (req, res) => {
    const { email, password } = signUpSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw BadRequest('Пользователь с таким email уже существует');

    const passwordHash = await hashPassword(password);
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Single transaction mirrors the old handle_new_user Postgres trigger: an account
    // never exists without its trial subscription + usage-stats row.
    const user = await prisma.$transaction(async (tx) => {
      // consentGivenAt is the audit record required by 152-ФЗ — proof of *when* consent
      // to the privacy policy/offer was given, not just that the checkbox exists in the UI.
      const created = await tx.user.create({ data: { email, passwordHash, consentGivenAt: new Date() } });
      await tx.subscription.create({ data: { ownerId: created.id, trialEndsAt } });
      await tx.userStats.create({ data: { ownerId: created.id } });
      return created;
    });

    const tokens = await issueTokens(user.id);
    res.status(201).json({ ...tokens, user: userToJson(user) });
  })
);

authRouter.post(
  '/sign-in',
  asyncHandler(async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw Unauthorized('Неверный email или пароль');
    }

    const tokens = await issueTokens(user.id);
    res.json({ ...tokens, user: userToJson(user) });
  })
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const hashed = hashRefreshToken(refreshToken);

    const stored = await prisma.refreshToken.findUnique({ where: { token: hashed } });
    if (!stored || stored.expiresAt < new Date()) {
      throw Unauthorized('Сессия истекла, войдите снова');
    }

    // Rotate on every refresh — the old token is single-use, limiting the blast radius
    // if a refresh token is ever leaked.
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const tokens = await issueTokens(stored.userId);
    res.json(tokens);
  })
);

authRouter.post(
  '/sign-out',
  asyncHandler(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    await prisma.refreshToken.deleteMany({ where: { token: hashRefreshToken(refreshToken) } });
    res.status(204).send();
  })
);

// Always responds with the same generic message whether or not the email exists —
// otherwise this endpoint would let anyone check which emails have accounts.
authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const code = generateResetCode();
      await prisma.user.update({
        where: { id: user.id },
        data: { resetCodeHash: hashResetCode(code), resetCodeExpiresAt: new Date(Date.now() + RESET_CODE_TTL_MS) },
      });
      if (isEmailConfigured()) {
        await sendPasswordResetEmail(user.email, code);
      } else {
        // No SMTP configured (e.g. local dev) — log it instead of silently discarding
        // the code, otherwise the flow is untestable without real email infra.
        console.log(`[forgot-password] SMTP not configured — reset code for ${user.email}: ${code}`);
      }
    }

    res.json({ message: 'Если аккаунт с таким email существует, мы отправили код для сброса пароля' });
  })
);

authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { email, code, newPassword } = resetPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (
      !user ||
      !user.resetCodeHash ||
      !user.resetCodeExpiresAt ||
      user.resetCodeExpiresAt < new Date() ||
      user.resetCodeHash !== hashResetCode(code)
    ) {
      throw BadRequest('Неверный или истёкший код');
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, resetCodeHash: null, resetCodeExpiresAt: null },
      }),
      // Forces re-login everywhere — standard practice after a password change, in case
      // the reset was prompted by a leaked/compromised password.
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    res.status(204).send();
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    res.json({ user: userToJson(user) });
  })
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { firstName, lastName, phone, email } = profileSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== req.userId) throw BadRequest('Этот email уже используется');

    const user = await prisma.user.update({ where: { id: req.userId }, data: { firstName, lastName, phone, email } });
    res.json({ user: userToJson(user) });
  })
);

// Called by the client once it obtains a RuStore Push token (see
// lib/rustorePushNotifications.ts) — no-op if RuStore Pay/Push isn't set up on this
// build, in which case the client never calls this at all. Storing the token doesn't
// send anything by itself — actually sending a push still needs a separate call to
// RuStore's own server-side Send API, not implemented yet.
authRouter.patch(
  '/push-token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = pushTokenSchema.parse(req.body);
    await prisma.user.update({ where: { id: req.userId }, data: { rustorePushToken: token } });
    res.status(204).send();
  })
);
