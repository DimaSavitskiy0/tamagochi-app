import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet } from 'react-native';

import { PetCartoonAvatar } from '@/components/pet/PetCartoonAvatar';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { PET_SPECIES_OPTIONS, type PetSpecies } from '@/types/database';

type PetAvatarPickerModalProps = {
  visible: boolean;
  species: PetSpecies;
  onClose: () => void;
  onSave: (input: { species: PetSpecies }) => Promise<void>;
};

export function PetAvatarPickerModal({ visible, species, onClose, onSave }: PetAvatarPickerModalProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');

  const [selectedSpecies, setSelectedSpecies] = useState(species);
  const [saving, setSaving] = useState(false);

  // React Native's Modal keeps children mounted while hidden, so this state would
  // otherwise stay frozen at whatever species the pet had on first mount —
  // re-sync it from props every time the modal is (re)opened.
  useEffect(() => {
    if (visible) {
      setSelectedSpecies(species);
    }
  }, [visible, species]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ species: selectedSpecies });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Внешность питомца</Text>

        <View style={[styles.previewWrap, { borderColor: tint }]}>
          <PetCartoonAvatar species={selectedSpecies} size={92} />
        </View>

        <Text style={styles.label}>Вид животного</Text>
        <View style={styles.chipRow}>
          {PET_SPECIES_OPTIONS.map((option) => {
            const active = option.value === selectedSpecies;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.chip,
                  { borderColor: active ? tint : borderColor, backgroundColor: active ? `${tint}22` : 'transparent' },
                ]}
                onPress={() => setSelectedSpecies(option.value)}>
                <Text style={styles.chipEmoji}>{option.emoji}</Text>
                <Text style={[styles.chipLabel, active && { color: tint, fontWeight: '800' }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.saveButton, { backgroundColor: tint, opacity: saving ? 0.5 : 1 }]}
          disabled={saving}
          onPress={handleSave}>
          <Text style={styles.saveButtonLabel}>{saving ? 'Сохранение…' : 'Сохранить'}</Text>
        </Pressable>

        <Pressable style={styles.cancelLink} onPress={onClose}>
          <Text style={[styles.cancelLinkText, { color: tint }]}>Отмена</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 18,
  },
  previewWrap: {
    alignSelf: 'center',
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.7,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
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
  cancelLink: {
    alignItems: 'center',
    marginTop: 14,
  },
  cancelLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
