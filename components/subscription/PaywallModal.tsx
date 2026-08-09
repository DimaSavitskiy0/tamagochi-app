import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { PRO_BENEFITS, PRO_PLAN_PRICE_LABEL } from '@/constants/proBenefits';

type PaywallModalProps = {
  visible: boolean;
  starting: boolean;
  error: string | null;
  onCheckout: () => void;
  onSignOut: () => void;
};

// Non-dismissible by design — this only ever shows once the 7-day free trial has run
// out with no Pro upgrade (see useSubscription().isLocked), so there's nowhere else in
// the app to send the owner until they either pay or sign out.
export function PaywallModal({ visible, starting, error, onCheckout, onSignOut }: PaywallModalProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {}}>
      <View style={styles.container}>
        <Text style={styles.title}>⏳ Пробный период закончился</Text>
        <Text style={styles.subtitle}>
          7 дней бесплатного доступа истекли. Оформите Pro, чтобы продолжить вести дневник и календарь питомца.
        </Text>

        <View style={[styles.card, { borderColor }]}>
          <Text style={styles.price}>{PRO_PLAN_PRICE_LABEL}</Text>
          {PRO_BENEFITS.map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={18} color={tint} />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.payButton, { backgroundColor: tint, opacity: starting ? 0.6 : 1 }]}
          disabled={starting}
          onPress={onCheckout}>
          {starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.payButtonLabel}>Оформить Pro</Text>}
        </Pressable>

        <Text style={styles.legalHint}>
          Подписка продлевается автоматически, управлять ей можно в приложении RuStore. Оплата — публичная{' '}
          <Text style={[styles.legalLink, { color: tint }]} onPress={() => router.push('/legal/offer')}>
            оферта
          </Text>
          .
        </Text>

        <Pressable style={styles.signOutButton} onPress={onSignOut}>
          <Text style={styles.signOutLabel}>Выйти из аккаунта</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.65,
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  benefitText: {
    fontSize: 14,
    flex: 1,
  },
  errorText: {
    color: '#e5484d',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  payButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  payButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  signOutButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  signOutLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.6,
  },
  legalHint: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
  legalLink: {
    fontWeight: '700',
    opacity: 1,
  },
});
