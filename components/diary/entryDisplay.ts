import type { Ionicons } from '@expo/vector-icons';

import type { DiaryEntry, DiaryEntryType } from '@/types/database';

type IoniconName = keyof typeof Ionicons.glyphMap;

export const ENTRY_TYPE_ORDER: DiaryEntryType[] = ['feeding', 'walk', 'play', 'weight', 'vet', 'medicine'];

export const ENTRY_TYPE_LABELS: Record<DiaryEntryType, string> = {
  feeding: 'Кормление',
  walk: 'Прогулка',
  play: 'Игра',
  weight: 'Вес',
  vet: 'Визит к ветеринару',
  medicine: 'Лекарство',
};

export const ENTRY_TYPE_ICONS: Record<DiaryEntryType, IoniconName> = {
  feeding: 'restaurant-outline',
  walk: 'walk-outline',
  play: 'tennisball-outline',
  weight: 'scale-outline',
  vet: 'medical-outline',
  medicine: 'medkit-outline',
};

export function getEntrySummary(entry: DiaryEntry): string {
  switch (entry.entry_type) {
    case 'feeding':
      return `${entry.metadata.food} — ${entry.metadata.amount}`;
    case 'walk':
    case 'play':
      return `${entry.metadata.durationMinutes} мин`;
    case 'weight':
      return `${entry.metadata.valueKg} кг`;
    case 'medicine':
      return `${entry.metadata.name} — ${entry.metadata.dosage}`;
    case 'vet':
      return entry.content;
  }
}
