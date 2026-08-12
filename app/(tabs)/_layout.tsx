import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { PetOnboardingModal } from '@/components/pet/PetOnboardingModal';
import { OwnerOnboardingModal } from '@/components/profile/OwnerOnboardingModal';
import { PaywallModal } from '@/components/subscription/PaywallModal';
import { useAuth } from '@/contexts/AuthProvider';
import { DiaryProvider } from '@/contexts/DiaryProvider';
import { PetProvider } from '@/contexts/PetProvider';
import { PetEventsProvider } from '@/contexts/PetEventsProvider';
import { RemindersProvider } from '@/contexts/RemindersProvider';
import { SubscriptionProvider, useSubscription } from '@/contexts/SubscriptionProvider';
import { usePet } from '@/hooks/usePet';
import { api, isBackendConfigured } from '@/lib/api';
import { requestNotificationPermissions } from '@/lib/notifications';
import { getRustorePushToken, isRustorePushAvailable, requestPushPermission } from '@/lib/rustorePushNotifications';

export const unstable_settings = {
  initialRouteName: 'pet',
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { sessionEpoch } = useAuth();

  // First entry into the authenticated app — ask once, upfront, so reminders can
  // actually notify later instead of silently never scheduling anything.
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // RuStore Push SDK registration — a no-op everywhere except a real native Android
  // build with RuStore Console set up (see lib/rustorePushNotifications.ts). Registering
  // the token doesn't make anything arrive yet — the server has nowhere to send a push
  // from until RuStore's server-side Send API is wired up separately.
  useEffect(() => {
    if (!isBackendConfigured || !isRustorePushAvailable()) return;
    (async () => {
      const granted = await requestPushPermission();
      if (!granted) return;
      const token = await getRustorePushToken();
      if (token) {
        try {
          await api.updatePushToken(token);
        } catch {
          // Not worth surfacing to the owner — push is a nice-to-have, and the next
          // app open retries anyway.
        }
      }
    })();
  }, []);

  return (
    // Keying on sessionEpoch forces a full remount (fresh mock pet, breed === null again)
    // on every offline sign-out/sign-in/sign-up, instead of silently reusing whatever pet
    // data the previous local session left behind.
    <PetProvider key={sessionEpoch}>
      <DiaryProvider>
        <RemindersProvider>
          <PetEventsProvider>
            <SubscriptionProvider key={sessionEpoch}>
              <TabsNavigator colorScheme={colorScheme} />
              <OnboardingGate />
              <PaywallGate />
            </SubscriptionProvider>
          </PetEventsProvider>
        </RemindersProvider>
      </DiaryProvider>
    </PetProvider>
  );
}

// Blocks the whole app once the 7-day free trial has run out with no Pro upgrade —
// rendered as a sibling of the tab navigator for the same reason as OnboardingGate:
// it must apply no matter which tab is currently active.
function PaywallGate() {
  const { isLocked, startCheckout, startingCheckout, checkoutError } = useSubscription();
  const { signOut } = useAuth();

  return (
    <PaywallModal
      visible={isLocked}
      starting={startingCheckout}
      error={checkoutError}
      onCheckout={startCheckout}
      onSignOut={signOut}
    />
  );
}

// Rendered as a sibling of the tab navigator (not inside a single tab screen) so the
// owner-before-pet onboarding gate applies no matter which tab is active on launch/reload.
function OnboardingGate() {
  const { hasOwnerProfile, skipOnboarding, updateProfile } = useAuth();
  const { pet, updatePet } = usePet();

  return (
    <>
      <OwnerOnboardingModal
        visible={!hasOwnerProfile && !skipOnboarding}
        onSubmit={async ({ firstName, lastName, phone }) => {
          const result = await updateProfile({ firstName, lastName, phone });
          if (result.error) throw new Error(result.error);
        }}
      />

      <PetOnboardingModal
        visible={hasOwnerProfile && pet.breed === null && !skipOnboarding}
        onSubmit={async (input) => {
          await updatePet(input);
        }}
      />
    </>
  );
}

function TabsNavigator({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Дневник',
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pet"
        options={{
          title: 'Питомец',
          tabBarIcon: ({ color, size }) => <Ionicons name="paw" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Календарь',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
