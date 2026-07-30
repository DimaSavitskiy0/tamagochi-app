import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_LABELS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthMatrix(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month, 1);
  // getDay(): 0=Sunday..6=Saturday: convert to Monday-first offset (0=Mon..6=Sun).
  const leadingOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - leadingOffset);

  const weeks: Date[][] = [];
  const cursor = new Date(gridStart);
  for (let week = 0; week < 6; week++) {
    const days: Date[] = [];
    for (let day = 0; day < 7; day++) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

type MonthGridProps = {
  year: number;
  month: number;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  markedDateKeys: Set<string>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export function MonthGrid({
  year,
  month,
  selectedDate,
  onSelectDate,
  markedDateKeys,
  onPrevMonth,
  onNextMonth,
}: MonthGridProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const today = new Date();
  const weeks = buildMonthMatrix(year, month);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onPrevMonth} hitSlop={10} accessibilityLabel="Предыдущий месяц">
          <Ionicons name="chevron-back" size={20} color={tint} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {MONTH_LABELS[month]} {year}
        </Text>
        <Pressable onPress={onNextMonth} hitSlop={10} accessibilityLabel="Следующий месяц">
          <Ionicons name="chevron-forward" size={20} color={tint} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((date, dayIndex) => {
            const inCurrentMonth = date.getMonth() === month;
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, today);
            const marked = markedDateKeys.has(toDateKey(date));

            return (
              <Pressable
                key={dayIndex}
                style={styles.dayCell}
                onPress={() => onSelectDate(date)}
                accessibilityLabel={toDateKey(date)}>
                <RNView
                  style={[
                    styles.dayCircle,
                    isSelected ? { backgroundColor: tint } : null,
                    !isSelected && isToday ? { borderWidth: 1.5, borderColor: tint } : null,
                  ]}>
                  <Text
                    style={[
                      styles.dayText,
                      !inCurrentMonth ? styles.dayTextMuted : null,
                      isSelected ? styles.dayTextSelected : null,
                    ]}>
                    {date.getDate()}
                  </Text>
                </RNView>
                {marked ? (
                  <RNView style={[styles.dot, { backgroundColor: isSelected ? tint : '#e0870a' }]} />
                ) : (
                  <RNView style={styles.dotPlaceholder} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.5,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 3,
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayTextMuted: {
    opacity: 0.3,
  },
  dayTextSelected: {
    color: '#fff',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  dotPlaceholder: {
    width: 4,
    height: 4,
    marginTop: 3,
  },
});
