import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type Field = {
  key: string;
  label: string;
  placeholder?: string;
};

type EditFieldsModalProps = {
  visible: boolean;
  title: string;
  fields: Field[];
  initialValues: Record<string, string>;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void>;
};

export function EditFieldsModal({ visible, title, fields, initialValues, onClose, onSubmit }: EditFieldsModalProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');
  const textColor = useThemeColor({}, 'text');

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValues(initialValues);
      setErrorMessage(null);
    }
    // Only re-seed when the modal opens, not on every initialValues identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const canSave = fields.every((field) => (values[field.key] ?? '').trim().length > 0) && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setErrorMessage(null);
    setSaving(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.closeLabel, { color: tint }]}>Закрыть</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          {fields.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                value={values[field.key] ?? ''}
                onChangeText={(text) => setValues((prev) => ({ ...prev, [field.key]: text }))}
                placeholder={field.placeholder}
                placeholderTextColor="#888"
                style={[styles.input, { borderColor, color: textColor }]}
              />
            </View>
          ))}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable
            style={[styles.saveButton, { backgroundColor: tint, opacity: canSave ? 1 : 0.5 }]}
            disabled={!canSave}
            onPress={handleSave}>
            <Text style={styles.saveButtonLabel}>{saving ? 'Сохранение…' : 'Сохранить'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  field: {
    marginBottom: 16,
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
  },
  errorText: {
    color: '#e5484d',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
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
