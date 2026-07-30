import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { cardShadow } from '@/lib/shadow';

type DeviceShellProps = {
  children: ReactNode;
  footer?: ReactNode;
};

export function DeviceShell({ children, footer }: DeviceShellProps) {
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['#cdb8fb', '#8f6fe8']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.shell}>
        <View style={styles.screenBezel}>
          <View style={styles.screen}>{children}</View>
        </View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: '100%',
  },
  shell: {
    width: '100%',
    borderRadius: 44,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 18,
    ...cardShadow({ opacity: 0.25, radius: 16, offsetY: 8, elevation: 8 }),
  },
  screenBezel: {
    backgroundColor: '#5a3fa0',
    borderRadius: 30,
    padding: 9,
  },
  screen: {
    backgroundColor: '#e3f0d8',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
  },
  footer: {
    marginTop: 10,
  },
});
