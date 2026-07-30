import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { serializeUserStats } from '../lib/serializers';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const statsRouter = Router();

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Ports the old record_app_open() Postgres function (security definer, called once per
// app session — see hooks/useUserStats.ts) into plain application code: same-day open
// is a no-op, the day right after last_active_date extends the streak, any bigger gap
// resets it to 1.
statsRouter.post(
  '/app-open',
  requireAuth,
  asyncHandler(async (req, res) => {
    const today = todayUTC();
    const todayStr = dateKey(today);

    const stats = await prisma.$transaction(async (tx) => {
      const existing = await tx.userStats.findUnique({ where: { ownerId: req.userId } });

      if (!existing) {
        return tx.userStats.create({
          data: { ownerId: req.userId, totalOpens: 1, currentStreak: 1, longestStreak: 1, lastActiveDate: today },
        });
      }

      const lastActiveStr = existing.lastActiveDate ? dateKey(existing.lastActiveDate) : null;
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = dateKey(yesterday);

      let currentStreak: number;
      if (lastActiveStr === todayStr) currentStreak = existing.currentStreak;
      else if (lastActiveStr === yesterdayStr) currentStreak = existing.currentStreak + 1;
      else currentStreak = 1;

      return tx.userStats.update({
        where: { ownerId: req.userId },
        data: {
          totalOpens: existing.totalOpens + 1,
          currentStreak,
          longestStreak: Math.max(existing.longestStreak, currentStreak),
          lastActiveDate: today,
        },
      });
    });

    res.json({ stats: serializeUserStats(stats) });
  })
);
