import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EditFieldsModal } from '@/components/profile/EditFieldsModal';
import Colors from '@/constants/Colors';
import { PRO_BENEFITS, PRO_PLAN_PRICE_LABEL } from '@/constants/proBenefits';
import { SUPPORT_EMAIL } from '@/constants/support';
import { useAuth } from '@/contexts/AuthProvider';
import { usePet } from '@/hooks/usePet';
import { useSubscription } from '@/contexts/SubscriptionProvider';
import { isBackendConfigured } from '@/lib/api';

function pluralizeDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дня';
  return 'дней';
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const { signOut, updateProfile, ownerProfile } = useAuth();
  const { pet, updatePet } = usePet();
  const {
    subscription,
    isPro,
    toggleMockPlan,
    startCheckout,
    startingCheckout,
    checkoutError,
    openSubscriptionManagement,
  } = useSubscription();
  const [editingOwner, setEditingOwner] = useState(false);
  const [editingPet, setEditingPet] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const isPastDue = subscription.status === 'past_due';

  const trialDaysLeft = Math.max(
    0,
    Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );

  const firstName = ownerProfile?.firstName ?? '';
  const lastName = ownerProfile?.lastName ?? '';
  const phone = ownerProfile?.phone ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  // ownerProfile.email is populated in both modes now — the real account email when a
  // backend is configured, or whatever the guest typed on the sign-in screen offline.
  const email = ownerProfile?.email ?? null;
  const contactLine = [email, phone].filter(Boolean).join(' • ');

  const accountTitle =
    fullName || email || (isBackendConfigured ? 'Не удалось определить пользователя' : 'Гость (офлайн-режим)');
  const accountSubtitle = fullName
    ? contactLine || (isBackendConfigured ? '' : 'Работаете в офлайн-режиме без аккаунта')
    : isBackendConfigured
      ? 'Вход выполнен'
      : 'Работаете в офлайн-режиме без аккаунта';

  return (
    <View style={styles.container}>
      <ScreenHeader />
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
              <Ionicons name="person" size={18} color={tint} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {accountTitle}
              </Text>
              {accountSubtitle ? (
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {accountSubtitle}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => setEditingOwner(true)} hitSlop={10} accessibilityLabel="Изменить имя">
              <Ionicons name="pencil" size={15} color={tint} />
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
              <Ionicons name="paw" size={16} color={tint} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {pet.name}
              </Text>
              {pet.breed ? (
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {pet.breed}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => setEditingPet(true)} hitSlop={10} accessibilityLabel="Изменить кличку">
              <Ionicons name="pencil" size={15} color={tint} />
            </Pressable>
          </View>

          <View style={styles.card}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: isPro ? 'rgba(224,168,0,0.15)' : 'rgba(120,120,120,0.12)' },
              ]}>
              <Ionicons name={isPro ? 'diamond' : 'diamond-outline'} size={17} color={isPro ? '#e0a800' : tint} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{isPro ? 'Pro' : 'Бесплатный план'}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {isPro
                  ? 'Активна'
                  : isPastDue
                    ? 'Проблема с оплатой — RuStore повторяет попытку списания'
                    : trialDaysLeft > 0
                      ? `Бесплатно ещё ${trialDaysLeft} ${pluralizeDays(trialDaysLeft)}, далее ${PRO_PLAN_PRICE_LABEL}`
                      : `Пробный период закончился · ${PRO_PLAN_PRICE_LABEL}`}
              </Text>
            </View>
          </View>

          {isPro && (
            <View style={styles.subscriptionActions}>
              {manageError ? <Text style={styles.checkoutErrorText}>{manageError}</Text> : null}
              <Pressable
                style={[styles.secondaryButton, { borderColor: tint }]}
                onPress={async () => {
                  const { error } = await openSubscriptionManagement();
                  setManageError(error);
                }}>
                <Text style={[styles.secondaryButtonLabel, { color: tint }]}>Управлять подпиской в RuStore</Text>
              </Pressable>
            </View>
          )}

          {!isPro && (
            <View style={[styles.offerCard, { borderColor: tint }]}>
              <Text style={styles.offerTitle}>✨ Перейдите на Pro</Text>
              {PRO_BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={14} color={tint} />
                  <Text style={styles.benefitText} numberOfLines={1}>
                    {benefit}
                  </Text>
                </View>
              ))}
              {checkoutError ? <Text style={styles.checkoutErrorText}>{checkoutError}</Text> : null}
              <Pressable
                style={[styles.upgradeButton, { backgroundColor: tint, opacity: startingCheckout ? 0.6 : 1 }]}
                disabled={startingCheckout}
                onPress={isBackendConfigured ? startCheckout : toggleMockPlan}>
                {startingCheckout ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.upgradeButtonLabel}>Оформить Pro</Text>
                )}
              </Pressable>
              {isBackendConfigured && (
                <Text style={styles.legalHint} numberOfLines={2}>
                  Автопродление {PRO_PLAN_PRICE_LABEL}, управлять можно в приложении RuStore. Оплата —{' '}
                  <Text style={[styles.legalLink, { color: tint }]} onPress={() => router.push('/legal/offer')}>
                    публичная оферта
                  </Text>
                  .
                </Text>
              )}
            </View>
          )}

          <Pressable style={styles.card} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
              <Ionicons name="mail" size={16} color={tint} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Служба поддержки</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {SUPPORT_EMAIL}
              </Text>
            </View>
          </Pressable>
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutLabel}>Выйти</Text>
        </Pressable>

        <View style={styles.legalLinksRow}>
          <Pressable onPress={() => router.push('/legal/offer')}>
            <Text style={styles.legalLinksText}>Публичная оферта</Text>
          </Pressable>
          <Text style={styles.legalLinksText}> · </Text>
          <Pressable onPress={() => router.push('/legal/privacy')}>
            <Text style={styles.legalLinksText}>Политика конфиденциальности</Text>
          </Pressable>
        </View>
      </View>

      <EditFieldsModal
        visible={editingOwner}
        title="Ваши данные"
        fields={[
          { key: 'firstName', label: 'Имя', placeholder: 'Имя' },
          { key: 'lastName', label: 'Фамилия', placeholder: 'Фамилия' },
          { key: 'email', label: 'Email', placeholder: 'Email' },
          { key: 'phone', label: 'Телефон', placeholder: 'Телефон' },
        ]}
        initialValues={{ firstName, lastName, phone, email: email ?? '' }}
        onClose={() => setEditingOwner(false)}
        onSubmit={async (values) => {
          const result = await updateProfile({
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            phone: values.phone.trim(),
            email: values.email.trim(),
          });
          if (result.error) throw new Error(result.error);
        }}
      />

      <EditFieldsModal
        visible={editingPet}
        title="Кличка питомца"
        fields={[{ key: 'name', label: 'Кличка', placeholder: 'Кличка' }]}
        initialValues={{ name: pet.name }}
        onClose={() => setEditingPet(false)}
        onSubmit={async (values) => {
          await updatePet({ name: values.name.trim() });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  row: {
    gap: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 9,
    borderRadius: 13,
    backgroundColor: 'rgba(120,120,120,0.08)',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  cardBody: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 11,
    opacity: 0.65,
    marginTop: 1,
  },
  offerCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  checkoutErrorText: {
    color: '#e5484d',
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  benefitText: {
    fontSize: 12,
    flex: 1,
  },
  upgradeButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  upgradeButtonLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  signOutButton: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: 'rgba(229,72,77,0.12)',
  },
  signOutLabel: {
    color: '#e5484d',
    fontSize: 13,
    fontWeight: '700',
  },
  subscriptionActions: {},
  secondaryButton: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  legalHint: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 6,
    lineHeight: 13,
  },
  legalLink: {
    fontWeight: '700',
    opacity: 1,
  },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  legalLinksText: {
    fontSize: 11,
    opacity: 0.5,
  },
});
