import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { PetOnboardingModal } from '@/components/pet/PetOnboardingModal';
import { OwnerOnboardingModal } from '@/components/profile/OwnerOnboardingModal';
import { PaywallModal } from '@/components/subscription/PaywallModal';
import { useAuth } from '@/contexts/AuthProvider';
import { PetProvider } from '@/contexts/PetProvider';
import { usePet } from '@/hooks/usePet';
import { useSubscription } from '@/hooks/useSubscription';
import { requestNotificationPermissions } from '@/lib/notifications';

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

  return (
    // Keying on sessionEpoch forces a full remount (fresh mock pet, breed === null again)
    // on every offline sign-out/sign-in/sign-up, instead of silently reusing whatever pet
    // data the previous local session left behind.
    <PetProvider key={sessionEpoch}>
      <TabsNavigator colorScheme={colorScheme} />
      <OnboardingGate />
      <PaywallGate />
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
