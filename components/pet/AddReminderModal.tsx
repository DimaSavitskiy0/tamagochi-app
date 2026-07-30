import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet } from 'react-native';

import { DatePickerField } from '@/components/calendar/DatePickerField';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { REMINDER_TYPE_ICONS, REMINDER_TYPE_LABELS, REMINDER_TYPE_ORDER } from '@/constants/reminders';
import type { ReminderType } from '@/types/database';

type AddReminderModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (type: ReminderType, dueDate: Date) => Promise<void>;
};

function defaultDueDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}

export function AddReminderModal({ visible, onClose, onSubmit }: AddReminderModalProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');

  const [selectedType, setSelectedType] = useState<ReminderType | null>(null);
  const [dueDate, setDueDate] = useState<Date>(defaultDueDate);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setSelectedType(null);
    setDueDate(defaultDueDate());
    setShowPicker(false);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!selectedType) return;
    setSaving(true);
    try {
      await onSubmit(selectedType, dueDate);
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.flex}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          {selectedType ? (
            <Pressable onPress={() => setSelectedType(null)} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={tint} />
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <Text style={styles.headerTitle}>{selectedType ? 'Когда напомнить' : 'Тип напоминания'}</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={tint} />
          </Pressable>
        </View>

        {!selectedType ? (
          <View style={styles.chipsWrap}>
            {REMINDER_TYPE_ORDER.map((type) => (
              <Pressable
                key={type}
                style={[styles.chip, { borderColor: tint }]}
                onPress={() => setSelectedType(type)}>
                <Ionicons name={REMINDER_TYPE_ICONS[type]} size={20} color={tint} />
                <Text style={[styles.chipLabel, { color: tint }]}>{REMINDER_TYPE_LABELS[type]}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Дата</Text>

            {Platform.OS === 'web' ? (
              <DatePickerField value={dueDate} onChange={setDueDate} minimumDate={new Date()} />
            ) : (
              <>
                <Pressable style={[styles.input, { borderColor }]} onPress={() => setShowPicker(true)}>
                  <Text>{dueDate.toLocaleDateString('ru-RU')}</Text>
                </Pressable>
                {showPicker && (
                  <DateTimePicker
                    value={dueDate}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(_event, date) => {
                      setShowPicker(false);
                      if (date) setDueDate(date);
                    }}
                  />
                )}
              </>
            )}

            <Pressable
              style={[styles.saveButton, { backgroundColor: tint, opacity: saving ? 0.5 : 1 }]}
              disabled={saving}
              onPress={handleSave}>
              <Text style={styles.saveButtonLabel}>{saving ? 'Сохранение…' : 'Запланировать'}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSpacer: {
    width: 24,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.7,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 44,
    justifyContent: 'center',
  },
  saveButton: {
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
