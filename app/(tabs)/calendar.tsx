import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AddEventModal } from '@/components/calendar/AddEventModal';
import { MonthGrid, toDateKey } from '@/components/calendar/MonthGrid';
import Colors from '@/constants/Colors';
import { REMINDER_TYPE_ICONS, REMINDER_TYPE_LABELS } from '@/constants/reminders';
import { useDiary } from '@/hooks/useDiary';
import { cardShadow } from '@/lib/shadow';
import { usePet } from '@/hooks/usePet';
import { usePetEvents } from '@/hooks/usePetEvents';
import { useReminders } from '@/hooks/useReminders';
import type { Reminder, PetEvent } from '@/types/database';

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatSelectedDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });
}

export default function CalendarScreen() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const { pet } = usePet();
  const { entries } = useDiary(pet.id);
  const { upcoming, markCompleted } = useReminders(pet.id, entries);
  const { events, addEvent, deleteEvent } = usePetEvents(pet.id);

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth());
  const [addEventVisible, setAddEventVisible] = useState(false);

  const markedDateKeys = useMemo(() => {
    const keys = new Set<string>();
    upcoming.forEach((reminder) => keys.add(toDateKey(new Date(reminder.due_date))));
    events.forEach((event) => keys.add(toDateKey(new Date(event.event_date))));
    return keys;
  }, [upcoming, events]);

  const remindersOnSelectedDay = upcoming.filter((r) => isSameDay(new Date(r.due_date), selectedDate));
  const eventsOnSelectedDay = events.filter((e) => isSameDay(new Date(e.event_date), selectedDate));
  const hasItems = remindersOnSelectedDay.length > 0 || eventsOnSelectedDay.length > 0;

  const goToPrevMonth = () => {
    const next = new Date(visibleYear, visibleMonth - 1, 1);
    setVisibleYear(next.getFullYear());
    setVisibleMonth(next.getMonth());
  };

  const goToNextMonth = () => {
    const next = new Date(visibleYear, visibleMonth + 1, 1);
    setVisibleYear(next.getFullYear());
    setVisibleMonth(next.getMonth());
  };

  return (
    <View style={styles.container}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <MonthGrid
          year={visibleYear}
          month={visibleMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          markedDateKeys={markedDateKeys}
          onPrevMonth={goToPrevMonth}
          onNextMonth={goToNextMonth}
        />

        <Text style={styles.selectedDateLabel}>{formatSelectedDate(selectedDate)}</Text>

        {!hasItems ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={36} color="#9a9a9a" />
            <Text style={styles.emptyText}>На этот день ничего не запланировано</Text>
          </View>
        ) : (
          <>
            {remindersOnSelectedDay.map((reminder: Reminder) => (
              <View key={reminder.id} style={styles.card}>
                <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
                  <Ionicons name={REMINDER_TYPE_ICONS[reminder.type]} size={20} color={tint} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{REMINDER_TYPE_LABELS[reminder.type]}</Text>
                  <Text style={styles.cardSubtitle}>Напоминание</Text>
                </View>
                <Pressable
                  onPress={() => markCompleted(reminder.id)}
                  hitSlop={8}
                  accessibilityLabel="Отметить выполненным">
                  <Ionicons name="checkmark-circle-outline" size={24} color={tint} />
                </Pressable>
              </View>
            ))}

            {eventsOnSelectedDay.map((event: PetEvent) => (
              <View key={event.id} style={styles.card}>
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(120,120,120,0.12)' }]}>
                  <Ionicons name="bookmark-outline" size={20} color={tint} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{event.title}</Text>
                  {event.notes ? <Text style={styles.cardSubtitle}>{event.notes}</Text> : null}
                </View>
                <Pressable onPress={() => deleteEvent(event.id)} hitSlop={8} accessibilityLabel="Удалить дело">
                  <Ionicons name="trash-outline" size={20} color="#e5484d" />
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { backgroundColor: tint }]}
        onPress={() => setAddEventVisible(true)}
        accessibilityLabel="Добавить дело">
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <AddEventModal
        visible={addEventVisible}
        initialDate={selectedDate}
        onClose={() => setAddEventVisible(false)}
        onSubmit={async (input) => {
          await addEvent(input);
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  selectedDateLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(120,120,120,0.08)',
    marginBottom: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 13,
    opacity: 0.65,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 10,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow({ opacity: 0.25, radius: 6, offsetY: 3, elevation: 4 }),
  },
});
