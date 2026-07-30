import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import type { DiaryEntryType, NewDiaryEntry } from '@/types/database';
import { ENTRY_TYPE_ICONS, ENTRY_TYPE_LABELS, ENTRY_TYPE_ORDER } from '@/components/diary/entryDisplay';

type AddEntryModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: NewDiaryEntry) => Promise<void>;
  /** When set, opens straight into that type's form instead of the type-picker step. */
  initialType?: DiaryEntryType;
};

type FormState = {
  food: string;
  amount: string;
  durationMinutes: string;
  valueKg: string;
  note: string;
  medicineName: string;
  dosage: string;
};

const EMPTY_FORM: FormState = {
  food: '',
  amount: '',
  durationMinutes: '',
  valueKg: '',
  note: '',
  medicineName: '',
  dosage: '',
};

function buildEntry(type: DiaryEntryType, form: FormState): NewDiaryEntry | null {
  switch (type) {
    case 'feeding': {
      const food = form.food.trim();
      const amount = form.amount.trim();
      if (!food || !amount) return null;
      return { entry_type: 'feeding', content: `${food} — ${amount}`, metadata: { food, amount } };
    }
    case 'walk': {
      const minutes = Number(form.durationMinutes);
      if (!form.durationMinutes.trim() || !Number.isFinite(minutes) || minutes <= 0) return null;
      return {
        entry_type: 'walk',
        content: `Прогулка ${minutes} мин`,
        metadata: { durationMinutes: minutes },
      };
    }
    case 'play': {
      const minutes = Number(form.durationMinutes);
      if (!form.durationMinutes.trim() || !Number.isFinite(minutes) || minutes <= 0) return null;
      return {
        entry_type: 'play',
        content: `Игра ${minutes} мин`,
        metadata: { durationMinutes: minutes },
      };
    }
    case 'weight': {
      const valueKg = Number(form.valueKg.replace(',', '.'));
      if (!form.valueKg.trim() || !Number.isFinite(valueKg) || valueKg <= 0) return null;
      return { entry_type: 'weight', content: `Вес: ${valueKg} кг`, metadata: { valueKg } };
    }
    case 'vet': {
      const note = form.note.trim();
      if (!note) return null;
      return { entry_type: 'vet', content: note, metadata: {} };
    }
    case 'medicine': {
      const name = form.medicineName.trim();
      const dosage = form.dosage.trim();
      if (!name || !dosage) return null;
      return {
        entry_type: 'medicine',
        content: `${name} — ${dosage}`,
        metadata: { name, dosage },
      };
    }
    default:
      return null;
  }
}

export function AddEntryModal({ visible, onClose, onSubmit, initialType }: AddEntryModalProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');

  const [selectedType, setSelectedType] = useState<DiaryEntryType | null>(initialType ?? null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedType(initialType ?? null);
      setForm(EMPTY_FORM);
    }
    // Re-initialize fresh every time the modal opens, not on every initialType identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const reset = () => {
    setSelectedType(initialType ?? null);
    setForm(EMPTY_FORM);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleBack = () => {
    setSelectedType(null);
  };

  const handleSave = async () => {
    if (!selectedType) return;
    const entry = buildEntry(selectedType, form);
    if (!entry) return;

    setSaving(true);
    try {
      await onSubmit(entry);
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canSave = selectedType ? buildEntry(selectedType, form) !== null : false;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.flex}>
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            {selectedType ? (
              <Pressable onPress={handleBack} hitSlop={12}>
                <Ionicons name="chevron-back" size={24} color={tint} />
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}
            <Text style={styles.headerTitle}>
              {selectedType ? ENTRY_TYPE_LABELS[selectedType] : 'Новая запись'}
            </Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={tint} />
            </Pressable>
          </View>

          {!selectedType ? (
            <View style={styles.chipsWrap}>
              {ENTRY_TYPE_ORDER.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.chip, { borderColor: tint }]}
                  onPress={() => setSelectedType(type)}>
                  <Ionicons name={ENTRY_TYPE_ICONS[type]} size={20} color={tint} />
                  <Text style={[styles.chipLabel, { color: tint }]}>{ENTRY_TYPE_LABELS[type]}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              {selectedType === 'feeding' && (
                <>
                  <FormField label="Что дал">
                    <StyledInput
                      value={form.food}
                      onChangeText={(food) => setForm((prev) => ({ ...prev, food }))}
                      placeholder="Например, сухой корм"
                      borderColor={borderColor}
                    />
                  </FormField>
                  <FormField label="Количество">
                    <StyledInput
                      value={form.amount}
                      onChangeText={(amount) => setForm((prev) => ({ ...prev, amount }))}
                      placeholder="Например, 150 г"
                      borderColor={borderColor}
                    />
                  </FormField>
                </>
              )}

              {(selectedType === 'walk' || selectedType === 'play') && (
                <FormField label="Длительность, мин">
                  <StyledInput
                    value={form.durationMinutes}
                    onChangeText={(durationMinutes) => setForm((prev) => ({ ...prev, durationMinutes }))}
                    placeholder="Например, 30"
                    keyboardType="numeric"
                    borderColor={borderColor}
                  />
                </FormField>
              )}

              {selectedType === 'weight' && (
                <FormField label="Вес, кг">
                  <StyledInput
                    value={form.valueKg}
                    onChangeText={(valueKg) => setForm((prev) => ({ ...prev, valueKg }))}
                    placeholder="Например, 4.2"
                    keyboardType="decimal-pad"
                    borderColor={borderColor}
                  />
                </FormField>
              )}

              {selectedType === 'vet' && (
                <FormField label="Заметка">
                  <StyledInput
                    value={form.note}
                    onChangeText={(note) => setForm((prev) => ({ ...prev, note }))}
                    placeholder="Что сказал врач, назначения..."
                    multiline
                    numberOfLines={5}
                    borderColor={borderColor}
                  />
                </FormField>
              )}

              {selectedType === 'medicine' && (
                <>
                  <FormField label="Название">
                    <StyledInput
                      value={form.medicineName}
                      onChangeText={(medicineName) => setForm((prev) => ({ ...prev, medicineName }))}
                      placeholder="Например, витамины"
                      borderColor={borderColor}
                    />
                  </FormField>
                  <FormField label="Дозировка">
                    <StyledInput
                      value={form.dosage}
                      onChangeText={(dosage) => setForm((prev) => ({ ...prev, dosage }))}
                      placeholder="Например, 1 таблетка"
                      borderColor={borderColor}
                    />
                  </FormField>
                </>
              )}

              <Pressable
                style={[styles.saveButton, { backgroundColor: tint, opacity: canSave && !saving ? 1 : 0.5 }]}
                disabled={!canSave || saving}
                onPress={handleSave}>
                <Text style={styles.saveButtonLabel}>{saving ? 'Сохранение…' : 'Сохранить'}</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function StyledInput(props: ComponentProps<typeof TextInput> & { borderColor: string }) {
  const { borderColor, style, ...rest } = props;
  const color = useThemeColor({}, 'text');
  return (
    <TextInput
      placeholderTextColor="#888"
      style={[styles.input, { borderColor, color }, style]}
      {...rest}
    />
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
    gap: 4,
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
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 44,
  },
  saveButton: {
    marginTop: 12,
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
