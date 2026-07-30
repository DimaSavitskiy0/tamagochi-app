import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AddReminderModal } from '@/components/pet/AddReminderModal';
import { RemindersSection } from '@/components/pet/RemindersSection';
import type { Reminder, ReminderType } from '@/types/database';

type RemindersModalProps = {
  visible: boolean;
  onClose: () => void;
  reminders: Reminder[];
  onComplete: (id: string) => void;
  onSchedule: (type: ReminderType, dueDate: Date) => Promise<void>;
};

export function RemindersModal({ visible, onClose, reminders, onComplete, onSchedule }: RemindersModalProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');
  const [addVisible, setAddVisible] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.flex}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <Pressable onPress={() => setAddVisible(true)} hitSlop={12} accessibilityLabel="Запланировать напоминание">
            <Ionicons name="add" size={26} color={tint} />
          </Pressable>
          <Text style={styles.headerTitle}>Напоминания</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={tint} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {reminders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color="#9a9a9a" />
              <Text style={styles.emptyText}>Активных напоминаний нет</Text>
            </View>
          ) : (
            <RemindersSection reminders={reminders} onComplete={onComplete} showTitle={false} />
          )}
        </ScrollView>
      </View>

      <AddReminderModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onSubmit={async (type, dueDate) => {
          await onSchedule(type, dueDate);
        }}
      />
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 12,
  },
});
