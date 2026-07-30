import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { REMINDER_TYPE_ICONS as REMINDER_ICONS, REMINDER_TYPE_LABELS as REMINDER_LABELS } from '@/constants/reminders';
import type { Reminder } from '@/types/database';

function formatDueLabel(dueDateIso: string): { text: string; overdue: boolean } {
  const due = new Date(dueDateIso);
  const now = new Date();
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return { text: 'Сегодня', overdue: false };
  if (diffDays === 1) return { text: 'Завтра', overdue: false };
  if (diffDays > 1) return { text: `Через ${diffDays} дн.`, overdue: false };
  return { text: `Просрочено на ${Math.abs(diffDays)} дн.`, overdue: true };
}

type RemindersSectionProps = {
  reminders: Reminder[];
  onComplete: (id: string) => void;
  limit?: number;
  showTitle?: boolean;
};

export function RemindersSection({ reminders, onComplete, limit = 3, showTitle = true }: RemindersSectionProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;

  if (reminders.length === 0) return null;

  const visible = limit ? reminders.slice(0, limit) : reminders;

  return (
    <View style={styles.section}>
      {showTitle ? <Text style={styles.sectionTitle}>Ближайшие напоминания</Text> : null}
      {visible.map((reminder) => {
        const { text, overdue } = formatDueLabel(reminder.due_date);
        return (
          <View key={reminder.id} style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
              <Ionicons name={REMINDER_ICONS[reminder.type]} size={20} color={tint} />
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{REMINDER_LABELS[reminder.type]}</Text>
              <Text style={[styles.due, overdue ? styles.overdue : null]}>{text}</Text>
            </View>
            <Pressable
              style={styles.doneButton}
              onPress={() => onComplete(reminder.id)}
              accessibilityLabel="Отметить выполненным"
              hitSlop={8}>
              <Ionicons name="checkmark-circle-outline" size={24} color={tint} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  body: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  due: {
    fontSize: 12,
    opacity: 0.65,
    marginTop: 2,
  },
  overdue: {
    color: '#e5484d',
    opacity: 1,
    fontWeight: '600',
  },
  doneButton: {
    padding: 4,
  },
});
