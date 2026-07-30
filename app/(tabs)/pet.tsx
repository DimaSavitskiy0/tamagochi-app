import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { View } from '@/components/Themed';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AddEntryModal } from '@/components/diary/AddEntryModal';
import { CelebrationToast } from '@/components/pet/CelebrationToast';
import { DeviceButtons } from '@/components/pet/DeviceButtons';
import { DeviceShell } from '@/components/pet/DeviceShell';
import { PetAvatarCard } from '@/components/pet/PetAvatarCard';
import { PetAvatarPickerModal } from '@/components/pet/PetAvatarPickerModal';
import { RecommendationsSection } from '@/components/pet/RecommendationsSection';
import { RemindersModal } from '@/components/pet/RemindersModal';
import { StatBar } from '@/components/pet/StatBar';
import { useDiary } from '@/hooks/useDiary';
import { usePet } from '@/hooks/usePet';
import { usePetEvents } from '@/hooks/usePetEvents';
import { useReminderNotifications } from '@/hooks/useReminderNotifications';
import { useReminders } from '@/hooks/useReminders';
import { useUserStats } from '@/hooks/useUserStats';
import { computeLevel } from '@/lib/petLevel';
import type { DiaryEntryType, NewDiaryEntry } from '@/types/database';

const LCD_TEXT_COLOR = '#33512f';
const LCD_TRACK_COLOR = 'rgba(51,81,47,0.15)';

// Which stat each device button's diary entry bumps, and by how much.
const STAT_BY_ENTRY_TYPE: Partial<Record<DiaryEntryType, { key: 'hunger' | 'mood' | 'health'; delta: number; label: string }>> = {
  feeding: { key: 'hunger', delta: 15, label: 'сытости' },
  play: { key: 'mood', delta: 15, label: 'настроению' },
  medicine: { key: 'health', delta: 15, label: 'здоровью' },
};

export default function PetScreen() {
  const { pet, updatePet, adjustStat } = usePet();
  const { entries, addEntry } = useDiary(pet.id);
  const { reminders, upcoming, markCompleted, createManualReminder } = useReminders(pet.id, entries);
  const { events } = usePetEvents(pet.id);
  const { stats } = useUserStats();
  const [activeEntryType, setActiveEntryType] = useState<DiaryEntryType | null>(null);
  const [remindersVisible, setRemindersVisible] = useState(false);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastSeq = useRef(0);

  useReminderNotifications(upcoming, pet.name);

  const completedRemindersCount = reminders.filter((r) => r.completed_at).length;
  const { level, progress } = computeLevel({
    diaryEntryCount: entries.length,
    completedReminderCount: completedRemindersCount,
    totalOpens: stats.total_opens,
    currentStreak: stats.current_streak,
  });
  const prevLevelRef = useRef(level);

  useEffect(() => {
    if (level > prevLevelRef.current) {
      showToast(`🎉 Новый уровень: ${level}!`);
    }
    prevLevelRef.current = level;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const showToast = (message: string) => {
    toastSeq.current += 1;
    const seq = toastSeq.current;
    setToastMessage(message);
    setTimeout(() => {
      if (toastSeq.current === seq) setToastMessage(null);
    }, 1900);
  };

  const handleEntrySubmit = async (input: NewDiaryEntry) => {
    await addEntry(input);
    const statBump = STAT_BY_ENTRY_TYPE[input.entry_type];
    if (statBump) {
      adjustStat(statBump.key, statBump.delta);
      showToast(`+${statBump.delta} к ${statBump.label}! ✨`);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        onSettingsPress={() => router.push('/profile')}
        onNotificationPress={() => setRemindersVisible(true)}
        hasNotification={upcoming.length > 0}
      />
      <View style={styles.content}>
        <DeviceShell
          footer={
            <DeviceButtons
              onFeed={() => setActiveEntryType('feeding')}
              onPlay={() => setActiveEntryType('play')}
              onCare={() => setActiveEntryType('medicine')}
            />
          }>
          <StatBar
            label={`Уровень ${level}`}
            emoji="⭐"
            value={progress}
            color="#7c4dff"
            trackColor={LCD_TRACK_COLOR}
            labelColor={LCD_TEXT_COLOR}
          />
          <PetAvatarCard
            name={pet.name}
            species={pet.species}
            onPress={() => setAvatarPickerVisible(true)}
            ringColor="#8f6fe8"
            nameColor={LCD_TEXT_COLOR}
            sceneColor={LCD_TEXT_COLOR}
          />
          <StatBar
            label="Сытость"
            emoji="🍖"
            value={pet.hunger}
            color="#c9762e"
            trackColor={LCD_TRACK_COLOR}
            labelColor={LCD_TEXT_COLOR}
          />
          <StatBar
            label="Настроение"
            emoji="😊"
            value={pet.mood}
            color="#2f6690"
            trackColor={LCD_TRACK_COLOR}
            labelColor={LCD_TEXT_COLOR}
          />
          <StatBar
            label="Здоровье"
            emoji="❤️"
            value={pet.health}
            color="#3a8f4a"
            trackColor={LCD_TRACK_COLOR}
            labelColor={LCD_TEXT_COLOR}
          />
        </DeviceShell>

        <RecommendationsSection pet={pet} entries={entries} reminders={upcoming} events={events} limit={3} />
      </View>

      <CelebrationToast message={toastMessage} />

      <AddEntryModal
        visible={activeEntryType !== null}
        initialType={activeEntryType ?? undefined}
        onClose={() => setActiveEntryType(null)}
        onSubmit={handleEntrySubmit}
      />

      <RemindersModal
        visible={remindersVisible}
        onClose={() => setRemindersVisible(false)}
        reminders={upcoming}
        onComplete={(id) => {
          markCompleted(id);
          showToast('+25 XP за напоминание! ✅');
        }}
        onSchedule={async (type, dueDate) => {
          await createManualReminder(type, dueDate);
        }}
      />

      <PetAvatarPickerModal
        visible={avatarPickerVisible}
        species={pet.species}
        onClose={() => setAvatarPickerVisible(false)}
        onSave={async ({ species }) => {
          await updatePet({ species });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
});
