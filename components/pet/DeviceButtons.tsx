import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import { cardShadow } from '@/lib/shadow';

type DeviceButtonProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function DeviceButton({ label, icon, onPress }: DeviceButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.column} accessibilityLabel={label}>
      <RNText style={styles.label}>{label}</RNText>
      <View style={styles.circle}>
        <View style={styles.highlight} />
      </View>
      <Ionicons name={icon} size={17} color="rgba(255,255,255,0.75)" style={styles.icon} />
    </Pressable>
  );
}

type DeviceButtonsProps = {
  onFeed: () => void;
  onPlay: () => void;
  onCare: () => void;
};

export function DeviceButtons({ onFeed, onPlay, onCare }: DeviceButtonsProps) {
  return (
    <View style={styles.row}>
      <DeviceButton label="Кормить" icon="restaurant-outline" onPress={onFeed} />
      <DeviceButton label="Играть" icon="tennisball-outline" onPress={onPlay} />
      <DeviceButton label="Уход" icon="sparkles-outline" onPress={onCare} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  column: {
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ff9db8',
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow({ opacity: 0.2, radius: 4, offsetY: 3, elevation: 3 }),
  },
  highlight: {
    position: 'absolute',
    top: 7,
    left: 10,
    width: 15,
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  icon: {
    marginTop: 4,
  },
});
