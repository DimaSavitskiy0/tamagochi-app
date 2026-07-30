import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAiRecommendation } from '@/hooks/useAiRecommendation';
import { isBackendConfigured } from '@/lib/api';

const ACCENT = '#8f6fe8';

// Shown offline (or before the server responds the first time) instead of leaving the
// card empty — there's no real backend to ask, so this is a fixed placeholder rather
// than a generated tip.
const OFFLINE_TIP = 'Питомцу нравится, когда о нём заботятся каждый день — кормите, играйте и вовремя показывайте ветеринару.';

// A personalized tip generated server-side by Claude from the pet's actual data (see
// server/src/lib/ai.ts). Falls back to a static placeholder offline, and renders
// nothing only if the server itself reports the feature unavailable (no
// ANTHROPIC_API_KEY configured), rather than faking a "real" AI response.
export function AiRecommendationCard({ petId }: { petId: string }) {
  const { tip, loading, refreshing, unavailable, refresh } = useAiRecommendation(petId);

  if (unavailable) return null;

  return (
    <View style={[styles.card, { borderColor: ACCENT }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerEmoji}>✨</Text>
        <Text style={styles.headerTitle}>Совет от ИИ</Text>
        {isBackendConfigured && (
          <Pressable onPress={refresh} disabled={loading || refreshing} hitSlop={10} accessibilityLabel="Обновить совет">
            {refreshing ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : (
              <Ionicons name="refresh" size={16} color={ACCENT} />
            )}
          </Pressable>
        )}
      </View>
      {isBackendConfigured && loading ? (
        <ActivityIndicator size="small" color={ACCENT} style={styles.loadingIndicator} />
      ) : (
        <Text style={styles.tipText}>{isBackendConfigured ? tip : OFFLINE_TIP}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerEmoji: {
    fontSize: 13,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  tipText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 4,
  },
  loadingIndicator: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
});
