import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { PetCartoonAvatar } from '@/components/pet/PetCartoonAvatar';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { PET_SPECIES_OPTIONS, type PetSpecies } from '@/types/database';

type PetOnboardingModalProps = {
  visible: boolean;
  onSubmit: (input: {
    name: string;
    breed: string;
    age_years: number;
    species: PetSpecies;
    hunger: number;
    mood: number;
    health: number;
  }) => Promise<void>;
};

type Step = 'info' | 'appearance' | 'stats';

function StatSlider({
  emoji,
  label,
  value,
  onChange,
  color,
}: {
  emoji: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  color: string;
}) {
  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderLabel}>
          {emoji} {label}
        </Text>
        <Text style={[styles.sliderValue, { color }]}>{Math.round(value)}%</Text>
      </View>
      <Slider
        value={value}
        onValueChange={onChange}
        minimumValue={0}
        maximumValue={100}
        step={1}
        minimumTrackTintColor={color}
        maximumTrackTintColor="rgba(120,120,120,0.2)"
        thumbTintColor={color}
      />
    </View>
  );
}

export function PetOnboardingModal({ visible, onSubmit }: PetOnboardingModalProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');
  const textColor = useThemeColor({}, 'text');

  const [step, setStep] = useState<Step>('info');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('cat');
  const [hunger, setHunger] = useState(70);
  const [mood, setMood] = useState(70);
  const [health, setHealth] = useState(85);
  const [saving, setSaving] = useState(false);

  const parsedAge = Number(age.replace(',', '.'));
  const canContinue =
    name.trim().length > 0 && breed.trim().length > 0 && age.trim().length > 0 && Number.isFinite(parsedAge) && parsedAge >= 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        breed: breed.trim(),
        age_years: parsedAge,
        species,
        hunger: Math.round(hunger),
        mood: Math.round(mood),
        health: Math.round(health),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {}}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 'info' ? (
          <View style={styles.container}>
            <Text style={styles.title}>Расскажите о питомце</Text>
            <Text style={styles.subtitle}>Это займёт минуту — данные помогут вести дневник и напоминания</Text>

            <Text style={styles.label}>Кличка</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Например, Мурзик"
              placeholderTextColor="#888"
              style={[styles.input, { borderColor, color: textColor }]}
            />

            <Text style={styles.label}>Порода</Text>
            <TextInput
              value={breed}
              onChangeText={setBreed}
              placeholder="Например, британская короткошёрстная"
              placeholderTextColor="#888"
              style={[styles.input, { borderColor, color: textColor }]}
            />

            <Text style={styles.label}>Возраст, лет</Text>
            <TextInput
              value={age}
              onChangeText={setAge}
              placeholder="Например, 2"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              style={[styles.input, { borderColor, color: textColor }]}
            />

            <Pressable
              style={[styles.saveButton, { backgroundColor: tint, opacity: canContinue ? 1 : 0.5 }]}
              disabled={!canContinue}
              onPress={() => setStep('appearance')}>
              <Text style={styles.saveButtonLabel}>Далее</Text>
            </Pressable>
          </View>
        ) : step === 'appearance' ? (
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Как выглядит питомец?</Text>
            <Text style={styles.subtitle}>Выберите вид — подберём для него аватарку</Text>

            <View style={[styles.previewWrap, { borderColor: tint }]}>
              <PetCartoonAvatar species={species} size={84} />
            </View>

            <Text style={styles.label}>Вид животного</Text>
            <View style={styles.chipRow}>
              {PET_SPECIES_OPTIONS.map((option) => {
                const active = option.value === species;
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.chip,
                      { borderColor: active ? tint : borderColor, backgroundColor: active ? `${tint}22` : 'transparent' },
                    ]}
                    onPress={() => setSpecies(option.value)}>
                    <Text style={styles.chipEmoji}>{option.emoji}</Text>
                    <Text style={[styles.chipLabel, active && { color: tint, fontWeight: '800' }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={[styles.saveButton, { backgroundColor: tint }]} onPress={() => setStep('stats')}>
              <Text style={styles.saveButtonLabel}>Далее</Text>
            </Pressable>

            <Pressable style={styles.backLink} onPress={() => setStep('info')}>
              <Text style={[styles.backLinkText, { color: tint }]}>Назад</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <View style={styles.container}>
            <Text style={styles.title}>Как дела у питомца?</Text>
            <Text style={styles.subtitle}>Оцените текущее состояние — с этого начнём на главном экране</Text>

            <StatSlider emoji="🍖" label="Сытость" value={hunger} onChange={setHunger} color="#c9762e" />
            <StatSlider emoji="😊" label="Настроение" value={mood} onChange={setMood} color="#2f6690" />
            <StatSlider emoji="❤️" label="Здоровье" value={health} onChange={setHealth} color="#3a8f4a" />

            <Pressable
              style={[styles.saveButton, { backgroundColor: tint, opacity: saving ? 0.5 : 1 }]}
              disabled={saving}
              onPress={handleSave}>
              <Text style={styles.saveButtonLabel}>{saving ? 'Сохранение…' : 'Продолжить'}</Text>
            </Pressable>

            <Pressable style={styles.backLink} onPress={() => setStep('appearance')}>
              <Text style={[styles.backLinkText, { color: tint }]}>Назад</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
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
  previewWrap: {
    alignSelf: 'center',
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  sliderBlock: {
    marginBottom: 22,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sliderLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  sliderValue: {
    fontSize: 15,
    fontWeight: '700',
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
  backLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
