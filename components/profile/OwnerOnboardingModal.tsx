import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type OwnerOnboardingModalProps = {
  visible: boolean;
  onSubmit: (input: { firstName: string; lastName: string; phone: string }) => Promise<void>;
};

export function OwnerOnboardingModal({ visible, onSubmit }: OwnerOnboardingModalProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');
  const textColor = useThemeColor({}, 'text');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = firstName.trim().length > 0 && lastName.trim().length > 0 && phone.trim().length >= 5 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {}}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Добро пожаловать! 👋</Text>
          <Text style={styles.subtitle}>Для начала расскажите немного о себе — а затем заведём питомца</Text>

          <Text style={styles.label}>Имя</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Имя"
            placeholderTextColor="#888"
            style={[styles.input, { borderColor, color: textColor }]}
          />

          <Text style={styles.label}>Фамилия</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Фамилия"
            placeholderTextColor="#888"
            style={[styles.input, { borderColor, color: textColor }]}
          />

          <Text style={styles.label}>Телефон</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+7 900 000-00-00"
            placeholderTextColor="#888"
            keyboardType="phone-pad"
            autoComplete="tel"
            style={[styles.input, { borderColor, color: textColor }]}
          />

          <Pressable
            style={[styles.saveButton, { backgroundColor: tint, opacity: canSave ? 1 : 0.5 }]}
            disabled={!canSave}
            onPress={handleSave}>
            <Text style={styles.saveButtonLabel}>{saving ? 'Сохранение…' : 'Далее'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 28,
  },
  label: {
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
    marginBottom: 16,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
