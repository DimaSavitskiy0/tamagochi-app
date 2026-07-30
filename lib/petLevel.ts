// Level/XP derived purely from real activity — diary entries logged, reminders
// completed, and how often/consistently the owner actually opens the app — rather than
// a stored counter, so there's nothing to keep in sync.
export type LevelInputs = {
  diaryEntryCount: number;
  completedReminderCount: number;
  totalOpens: number;
  currentStreak: number;
};

export function computeLevel({ diaryEntryCount, completedReminderCount, totalOpens, currentStreak }: LevelInputs) {
  const xp = diaryEntryCount * 10 + completedReminderCount * 25 + totalOpens * 5 + currentStreak * 15;
  const level = Math.floor(xp / 100) + 1;
  const progress = xp % 100;
  return { xp, level, progress };
}
