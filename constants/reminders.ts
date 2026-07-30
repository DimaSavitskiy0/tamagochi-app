import type { Ionicons } from '@expo/vector-icons';

import type { ReminderType } from '@/types/database';

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  vaccination: 'Вакцинация',
  deworming: 'Дегельминтизация',
  vet_visit: 'Визит к ветеринару',
  medicine: 'Приём лекарства',
};

export const REMINDER_TYPE_ICONS: Record<ReminderType, keyof typeof Ionicons.glyphMap> = {
  vaccination: 'shield-checkmark-outline',
  deworming: 'bug-outline',
  vet_visit: 'medical-outline',
  medicine: 'medkit-outline',
};

export const REMINDER_TYPE_ORDER: ReminderType[] = ['vaccination', 'deworming', 'vet_visit', 'medicine'];
