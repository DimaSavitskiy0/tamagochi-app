import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

import { DatePickerField } from '@/components/calendar/DatePickerField';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type AddEventModalProps = {
  visible: boolean;
  initialDate: Date;
  onClose: () => void;
  onSubmit: (input: { title: string; eventDate: Date; notes?: string }) => Promise<void>;
};

export function AddEventModal({ visible, initialDate, onClose, onSubmit }: AddEventModalProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');
  const textColor = useThemeColor({}, 'text');

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [eventDate, setEventDate] = useState(initialDate);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setNotes('');
      setEventDate(initialDate);
      setShowPicker(false);
    }
    // Only re-seed the form when the modal opens, not on every initialDate identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const canSave = title.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), eventDate, notes: notes.trim() || undefined });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.flex}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>Новое дело</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.closeLabel, { color: tint }]}>Закрыть</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Что запланировать</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Например, запись к ветеринару"
            placeholderTextColor="#888"
            style={[styles.input, { borderColor, color: textColor }]}
          />

          <Text style={styles.fieldLabel}>Дата</Text>
          {Platform.OS === 'web' ? (
            <DatePickerField value={eventDate} onChange={setEventDate} />
          ) : (
            <>
              <Pressable style={[styles.input, { borderColor }]} onPress={() => setShowPicker(true)}>
                <Text>{eventDate.toLocaleDateString('ru-RU')}</Text>
              </Pressable>
              {showPicker && (
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  onChange={(_event, date) => {
                    setShowPicker(false);
                    if (date) setEventDate(date);
                  }}
                />
              )}
            </>
          )}

          <Text style={styles.fieldLabel}>Заметка (необязательно)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Детали, адрес, что взять с собой..."
            placeholderTextColor="#888"
            multiline
            numberOfLines={4}
            style={[styles.input, styles.notesInput, { borderColor, color: textColor }]}
          />

          <Pressable
            style={[styles.saveButton, { backgroundColor: tint, opacity: canSave ? 1 : 0.5 }]}
            disabled={!canSave}
            onPress={handleSave}>
            <Text style={styles.saveButtonLabel}>{saving ? 'Сохранение…' : 'Запланировать'}</Text>
          </Pressable>
        </View>
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
    width: 60,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeLabel: {
    fontSize: 15,
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
    marginBottom: 16,
    justifyContent: 'center',
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
