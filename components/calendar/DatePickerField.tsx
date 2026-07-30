import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { MonthGrid } from '@/components/calendar/MonthGrid';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type DatePickerFieldProps = {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Tap-to-pick calendar grid (reuses the same MonthGrid as the Календарь tab) instead of
// making the owner type a date by hand — the only thing that differed between platforms
// before was the web fallback, which was a raw "ГГГГ-ММ-ДД" text field.
export function DatePickerField({ value, onChange, minimumDate }: DatePickerFieldProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');

  const [visible, setVisible] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const open = () => {
    setViewYear(value.getFullYear());
    setViewMonth(value.getMonth());
    setVisible(true);
  };

  const handleSelect = (date: Date) => {
    if (minimumDate && startOfDay(date) < startOfDay(minimumDate)) return;
    onChange(date);
    setVisible(false);
  };

  const goPrevMonth = () => {
    const next = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const goNextMonth = () => {
    const next = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <>
      <Pressable style={[styles.field, { borderColor }]} onPress={open} accessibilityLabel="Выбрать дату">
        <Text style={styles.fieldText}>{value.toLocaleDateString('ru-RU')}</Text>
        <Ionicons name="calendar-outline" size={18} color={tint} />
      </Pressable>

      <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={[styles.sheet, { borderColor }]}>
              <MonthGrid
                year={viewYear}
                month={viewMonth}
                selectedDate={value}
                onSelectDate={handleSelect}
                markedDateKeys={new Set()}
                onPrevMonth={goPrevMonth}
                onNextMonth={goNextMonth}
              />
              <Pressable style={[styles.doneButton, { backgroundColor: tint }]} onPress={() => setVisible(false)}>
                <Text style={styles.doneButtonLabel}>Готово</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    marginBottom: 16,
  },
  fieldText: {
    fontSize: 15,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 24,
  },
  sheet: {
    width: 320,
    maxWidth: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  doneButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  doneButtonLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
