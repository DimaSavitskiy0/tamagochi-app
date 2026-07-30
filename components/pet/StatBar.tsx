import { StyleSheet, Text as RNText, View } from 'react-native';

type StatBarProps = {
  label: string;
  emoji: string;
  value: number;
  color: string;
  trackColor?: string;
  labelColor?: string;
};

export function StatBar({ label, emoji, value, color, trackColor, labelColor }: StatBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <View style={styles.labelGroup}>
          <RNText style={styles.emoji}>{emoji}</RNText>
          <RNText style={[styles.label, labelColor ? { color: labelColor } : null]}>{label}</RNText>
        </View>
        <RNText style={[styles.value, { color }]}>{clamped}%</RNText>
      </View>
      <View style={[styles.track, trackColor ? { backgroundColor: trackColor, borderColor: trackColor } : null]}>
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emoji: {
    fontSize: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  value: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
  },
  track: {
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
