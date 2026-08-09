// Hand-written types shared across the app. Field names stay snake_case on purpose,
// matching what the server (server/src/lib/serializers.ts) returns — these used to
// mirror supabase/schema.sql, and keeping the same shape after migrating to the custom
// Node backend meant every hook body barely had to change, just its data source.

export type PetSpecies = 'cat' | 'dog' | 'rabbit' | 'hamster' | 'bird' | 'fish' | 'other';

export const PET_SPECIES_OPTIONS: { value: PetSpecies; label: string; emoji: string }[] = [
  { value: 'cat', label: 'Кошка', emoji: '🐱' },
  { value: 'dog', label: 'Собака', emoji: '🐶' },
  { value: 'rabbit', label: 'Кролик', emoji: '🐰' },
  { value: 'hamster', label: 'Хомяк', emoji: '🐹' },
  { value: 'bird', label: 'Птица', emoji: '🐦' },
  { value: 'fish', label: 'Рыбка', emoji: '🐠' },
  { value: 'other', label: 'Другое', emoji: '🐾' },
];

export type Pet = {
  id: string;
  owner_id: string;
  name: string;
  breed: string | null;
  age_years: number | null;
  species: PetSpecies;
  hunger: number;
  mood: number;
  health: number;
  created_at: string;
  updated_at: string;
};

export type DiaryEntryType = 'feeding' | 'walk' | 'play' | 'weight' | 'vet' | 'medicine';

export type DiaryEntryMetadataMap = {
  feeding: { food: string; amount: string };
  walk: { durationMinutes: number };
  play: { durationMinutes: number };
  weight: { valueKg: number };
  vet: Record<string, never>;
  medicine: { name: string; dosage: string };
};

export type DiaryEntry = {
  [T in DiaryEntryType]: {
    id: string;
    pet_id: string;
    owner_id: string;
    entry_type: T;
    content: string;
    mood_tag: string | null;
    metadata: DiaryEntryMetadataMap[T];
    created_at: string;
  };
}[DiaryEntryType];

export type NewDiaryEntry = {
  [T in DiaryEntryType]: {
    entry_type: T;
    content: string;
    metadata: DiaryEntryMetadataMap[T];
  };
}[DiaryEntryType];

export type ReminderType = 'vaccination' | 'deworming' | 'vet_visit' | 'medicine';
export type ReminderSource = 'auto' | 'manual';

export type Reminder = {
  id: string;
  pet_id: string;
  owner_id: string;
  type: ReminderType;
  due_date: string;
  completed_at: string | null;
  source: ReminderSource;
  created_at: string;
};

export type PetStatSnapshot = {
  id: string;
  pet_id: string;
  owner_id: string;
  hunger: number;
  mood: number;
  health: number;
  recorded_at: string;
};

export type PetEvent = {
  id: string;
  pet_id: string;
  owner_id: string;
  title: string;
  event_date: string;
  notes: string | null;
  created_at: string;
};

export type Subscription = {
  id: string;
  owner_id: string;
  plan: 'free' | 'pro';
  status: 'active' | 'canceled' | 'past_due';
  current_period_end: string | null;
  trial_ends_at: string;
  created_at: string;
  updated_at: string;
};

export type UserStats = {
  owner_id: string;
  total_opens: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  created_at: string;
  updated_at: string;
};
