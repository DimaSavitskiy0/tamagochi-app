import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type ScreenHeaderProps = {
  onSettingsPress?: () => void;
  onNotificationPress?: () => void;
  hasNotification?: boolean;
};

// Matches the "🐾 Тамаго 🐾" branding across every tab, so every screen opens with
// the same app identity. The settings/notification buttons are optional — only the
// pet screen passes them, since that's the only place they make sense.
export function ScreenHeader({ onSettingsPress, onNotificationPress, hasNotification }: ScreenHeaderProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const iconBackground = useThemeColor({ light: `${tint}1a`, dark: `${tint}33` }, 'background');

  return (
    <View style={styles.row}>
      {onSettingsPress ? (
        <Pressable
          onPress={onSettingsPress}
          hitSlop={10}
          style={[styles.iconButton, { backgroundColor: iconBackground }]}
          accessibilityLabel="Настройки">
          <Ionicons name="settings-outline" size={20} color={tint} />
        </Pressable>
      ) : null}

      <Text style={styles.title}>🐾 Тамаго 🐾</Text>

      {onNotificationPress ? (
        <Pressable
          onPress={onNotificationPress}
          hitSlop={10}
          style={[styles.iconButton, { backgroundColor: iconBackground }]}
          accessibilityLabel="Напоминания">
          <Ionicons name="notifications-outline" size={20} color={tint} />
          {hasNotification ? <View style={styles.badge} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ff5c7a',
  },
});
