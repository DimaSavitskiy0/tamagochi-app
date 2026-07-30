import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AddEntryModal } from '@/components/diary/AddEntryModal';
import { ENTRY_TYPE_ICONS, ENTRY_TYPE_LABELS, getEntrySummary } from '@/components/diary/entryDisplay';
import { PetStatsChart, type ChartPoint, type ChartSeries } from '@/components/diary/PetStatsChart';
import Colors from '@/constants/Colors';
import { useDiary } from '@/hooks/useDiary';
import { usePet } from '@/hooks/usePet';
import { usePetStatHistory } from '@/hooks/usePetStatHistory';
import { cardShadow } from '@/lib/shadow';
import type { DiaryEntry, NewDiaryEntry, PetStatSnapshot } from '@/types/database';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function formatSectionTitle(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return 'Сегодня';
  if (isSameDay(date, yesterday)) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function groupEntriesByDate(entries: DiaryEntry[]): { title: string; data: DiaryEntry[] }[] {
  const sections: { title: string; data: DiaryEntry[] }[] = [];

  for (const entry of entries) {
    const title = formatSectionTitle(new Date(entry.created_at));
    const lastSection = sections[sections.length - 1];
    if (lastSection && lastSection.title === title) {
      lastSection.data.push(entry);
    } else {
      sections.push({ title, data: [entry] });
    }
  }

  return sections;
}

function isWeightEntry(entry: DiaryEntry): entry is Extract<DiaryEntry, { entry_type: 'weight' }> {
  return entry.entry_type === 'weight';
}

function getWeightPoints(entries: DiaryEntry[]): ChartPoint[] {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const weightEntries = entries
    .filter(isWeightEntry)
    .filter((entry) => new Date(entry.created_at).getTime() >= cutoff)
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  return weightEntries.map((entry) => ({ date: entry.created_at, value: entry.metadata.valueKg }));
}

function getSnapshotPoints(snapshots: PetStatSnapshot[], key: 'mood' | 'health'): ChartPoint[] {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  return snapshots
    .filter((snapshot) => new Date(snapshot.recorded_at).getTime() >= cutoff)
    .map((snapshot) => ({ date: snapshot.recorded_at, value: snapshot[key] }));
}

function EntryCard({ entry }: { entry: DiaryEntry }) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const time = new Date(entry.created_at).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={ENTRY_TYPE_ICONS[entry.entry_type]} size={20} color={tint} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{ENTRY_TYPE_LABELS[entry.entry_type]}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {getEntrySummary(entry)}
        </Text>
      </View>
      <Text style={styles.cardTime}>{time}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="book-outline" size={48} color="#9a9a9a" />
      <Text style={styles.emptyTitle}>Дневник пуст</Text>
      <Text style={styles.emptySubtitle}>
        Добавьте первую запись о кормлении, прогулке, весе, лекарстве или визите к ветеринару — нажмите «+»
        внизу экрана
      </Text>
    </View>
  );
}

export default function DiaryScreen() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const { pet } = usePet();
  const { entries, loading, addEntry } = useDiary(pet.id);
  const { snapshots } = usePetStatHistory(pet.id);
  const [modalVisible, setModalVisible] = useState(false);

  const sections = useMemo(() => groupEntriesByDate(entries), [entries]);

  const chartSeries: ChartSeries[] = useMemo(
    () => [
      { key: 'weight', label: 'Вес', color: '#7c4dff', unit: 'кг', points: getWeightPoints(entries) },
      { key: 'mood', label: 'Настроение', color: '#2f6690', unit: '%', points: getSnapshotPoints(snapshots, 'mood') },
      {
        key: 'health',
        label: 'Здоровье',
        color: '#3a8f4a',
        unit: '%',
        points: getSnapshotPoints(snapshots, 'health'),
      },
    ],
    [entries, snapshots]
  );

  const handleSubmit = async (input: NewDiaryEntry) => {
    await addEntry(input);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          renderItem={({ item }) => <EntryCard entry={item} />}
          ListHeaderComponent={<PetStatsChart series={chartSeries} />}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
        />
      )}

      <Pressable
        style={[styles.fab, { backgroundColor: tint }]}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Добавить запись">
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <AddEntryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    opacity: 0.7,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(120,120,120,0.08)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 13,
    opacity: 0.65,
    marginTop: 2,
  },
  cardTime: {
    fontSize: 12,
    opacity: 0.5,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow({ opacity: 0.25, radius: 6, offsetY: 3, elevation: 4 }),
  },
});
