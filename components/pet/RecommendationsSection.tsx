import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import type { DiaryEntry, DiaryEntryType, Pet, PetEvent, Reminder, ReminderType } from '@/types/database';

type Tone = 'warning' | 'positive' | 'info';

type Recommendation = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone: Tone;
};

const TONE_COLORS: Record<Tone, { background: string; accent: string }> = {
  warning: { background: 'rgba(255,159,10,0.14)', accent: '#e0870a' },
  positive: { background: 'rgba(48,209,88,0.14)', accent: '#2a9d47' },
  info: { background: 'rgba(10,132,255,0.12)', accent: '#0a84ff' },
};

const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  vaccination: 'вакцинация',
  deworming: 'дегельминтизация',
  vet_visit: 'визит к ветеринару',
  medicine: 'приём лекарства',
};

const VET_VISIT_STALE_DAYS = 180;
const UPCOMING_SOON_DAYS = 2;

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function daysUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

function latestEntryHoursAgo(entries: DiaryEntry[], type: DiaryEntryType | DiaryEntryType[]): number | null {
  const types = Array.isArray(type) ? type : [type];
  const matches = entries.filter((entry) => types.includes(entry.entry_type));
  if (matches.length === 0) return null;
  const latest = matches.reduce(
    (acc, entry) => (entry.created_at > acc ? entry.created_at : acc),
    matches[0].created_at
  );
  return hoursSince(latest);
}

function weightTrend(entries: DiaryEntry[]): { fromKg: number; toKg: number; changeRatio: number } | null {
  const weighIns = entries
    .filter((entry): entry is Extract<DiaryEntry, { entry_type: 'weight' }> => entry.entry_type === 'weight')
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  if (weighIns.length < 2) return null;

  const [previous, latest] = weighIns.slice(-2);
  const fromKg = previous.metadata.valueKg;
  const toKg = latest.metadata.valueKg;
  if (!fromKg) return null;

  return { fromKg, toKg, changeRatio: (toKg - fromKg) / fromKg };
}

function buildRecommendations(pet: Pet, entries: DiaryEntry[], reminders: Reminder[], events: PetEvent[]): Recommendation[] {
  const tips: Recommendation[] = [];

  const overdue = reminders.find((r) => !r.completed_at && new Date(r.due_date).getTime() < Date.now());
  if (overdue) {
    tips.push({
      id: 'overdue',
      icon: 'alert-circle',
      text: `Просрочено напоминание: ${REMINDER_TYPE_LABELS[overdue.type]}`,
      tone: 'warning',
    });
  }

  if (pet.hunger < 40) {
    tips.push({
      id: 'hunger',
      icon: 'restaurant-outline',
      text: 'Питомец голоден — самое время покормить',
      tone: 'warning',
    });
  }

  if (pet.mood < 40) {
    tips.push({
      id: 'mood',
      icon: 'happy-outline',
      text: 'Настроение снижено — поиграйте или прогуляйтесь с питомцем',
      tone: 'warning',
    });
  }

  if (pet.health < 40) {
    tips.push({
      id: 'health',
      icon: 'medkit-outline',
      text: 'Здоровье ниже нормы — присмотритесь к питомцу',
      tone: 'warning',
    });
  }

  const feedingHoursAgo = latestEntryHoursAgo(entries, 'feeding');
  if (feedingHoursAgo === null || feedingHoursAgo > 12) {
    tips.push({
      id: 'feeding-overdue',
      icon: 'time-outline',
      text: 'С последнего кормления прошло больше 12 часов',
      tone: 'warning',
    });
  }

  const walkHoursAgo = latestEntryHoursAgo(entries, ['walk', 'play']);
  if (walkHoursAgo === null || walkHoursAgo > 24) {
    tips.push({ id: 'walk-overdue', icon: 'walk-outline', text: 'Питомец давно не гулял и не играл', tone: 'warning' });
  }

  const trend = weightTrend(entries);
  if (trend && trend.changeRatio <= -0.1) {
    tips.push({
      id: 'weight-drop',
      icon: 'trending-down-outline',
      text: `Вес снизился с ${trend.fromKg} до ${trend.toKg} кг — стоит показать питомца ветеринару`,
      tone: 'warning',
    });
  } else if (trend && trend.changeRatio >= 0.15) {
    tips.push({
      id: 'weight-gain',
      icon: 'trending-up-outline',
      text: `Вес вырос с ${trend.fromKg} до ${trend.toKg} кг — понаблюдайте за питанием`,
      tone: 'warning',
    });
  }

  const vetHoursAgo = latestEntryHoursAgo(entries, 'vet');
  if (vetHoursAgo === null || vetHoursAgo > VET_VISIT_STALE_DAYS * 24) {
    tips.push({
      id: 'vet-stale',
      icon: 'medical-outline',
      text:
        vetHoursAgo === null
          ? 'Ещё не было ни одного визита к ветеринару — стоит запланировать плановый осмотр'
          : 'С последнего визита к ветеринару прошло больше полугода',
      tone: 'info',
    });
  }

  const upcomingReminder = reminders
    .filter((r) => !r.completed_at && daysUntil(r.due_date) >= 0 && daysUntil(r.due_date) <= UPCOMING_SOON_DAYS)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0];
  if (upcomingReminder) {
    tips.push({
      id: 'reminder-soon',
      icon: 'notifications-outline',
      text: `Скоро: ${REMINDER_TYPE_LABELS[upcomingReminder.type]} (${new Date(upcomingReminder.due_date).toLocaleDateString('ru-RU')})`,
      tone: 'info',
    });
  }

  const upcomingEvent = events
    .filter((e) => daysUntil(e.event_date) >= 0 && daysUntil(e.event_date) <= UPCOMING_SOON_DAYS)
    .sort((a, b) => (a.event_date < b.event_date ? -1 : 1))[0];
  if (upcomingEvent) {
    tips.push({
      id: 'event-soon',
      icon: 'calendar-outline',
      text: `Скоро в календаре: ${upcomingEvent.title} (${new Date(upcomingEvent.event_date).toLocaleDateString('ru-RU')})`,
      tone: 'info',
    });
  }

  if (entries.length === 0) {
    tips.push({
      id: 'empty-diary',
      icon: 'book-outline',
      text: 'Начните вести дневник — так рекомендации станут точнее',
      tone: 'info',
    });
  }

  if (tips.length === 0) {
    tips.push({ id: 'all-good', icon: 'happy', text: 'Всё отлично! Питомец здоров и счастлив 🎉', tone: 'positive' });
  }

  return tips;
}

type RecommendationsSectionProps = {
  pet: Pet;
  entries: DiaryEntry[];
  reminders: Reminder[];
  events?: PetEvent[];
  limit?: number;
};

// Labeled "AI рекомендации" per product decision, but the tips below are still the
// plain rule-based logic in buildRecommendations() — real AI generation (see
// components/pet/AiRecommendationCard.tsx, currently unused) is planned for later.
export function RecommendationsSection({ pet, entries, reminders, events = [], limit = 3 }: RecommendationsSectionProps) {
  const tips = buildRecommendations(pet, entries, reminders, events).slice(0, limit);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderEmoji}>✨</Text>
        <Text style={styles.sectionTitle}>AI рекомендации</Text>
      </View>
      {tips.map((tip) => {
        const colors = TONE_COLORS[tip.tone];
        return (
          <View
            key={tip.id}
            style={[styles.card, { backgroundColor: colors.background, borderLeftColor: colors.accent }]}>
            <Ionicons name={tip.icon} size={18} color={colors.accent} style={styles.icon} />
            <Text style={styles.text} numberOfLines={2}>
              {tip.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sectionHeaderEmoji: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
