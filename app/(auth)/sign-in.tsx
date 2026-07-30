import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { PasswordField } from '@/components/auth/PasswordField';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthProvider';

type Action = 'sign-in' | 'sign-up' | null;

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const { signInWithPassword, signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [pendingAction, setPendingAction] = useState<Action>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && pendingAction === null;
  // Only registration requires consent — signing back in with an existing account
  // doesn't collect any new personal data.
  const canRegister = canSubmit && consent;

  const handleSignIn = async () => {
    if (!canSubmit) return;
    setErrorMessage(null);
    setPendingAction('sign-in');
    const result = await signInWithPassword(email.trim(), password);
    setPendingAction(null);

    if (result.error) {
      setErrorMessage(result.error);
    }
  };

  const handleRegister = async () => {
    if (!canRegister) return;
    setErrorMessage(null);
    setPendingAction('sign-up');
    const result = await signUp(email.trim(), password, consent);
    setPendingAction(null);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    // On success, isAuthenticated flips to true and the "Добро пожаловать" onboarding
    // (owner + pet data) takes over automatically.
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.title}>🐾 Тамагочи</Text>
        <Text style={styles.subtitle}>Войдите по email и паролю, чтобы продолжить</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#888"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={[styles.input, { borderColor, color: textColor }]}
        />
        <PasswordField value={password} onChangeText={setPassword} placeholder="Пароль" />

        <Pressable
          style={styles.forgotPasswordLink}
          onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })}
          hitSlop={6}>
          <Text style={[styles.forgotPasswordText, { color: tint }]}>Забыли пароль?</Text>
        </Pressable>

        <Pressable style={styles.consentRow} onPress={() => setConsent((c) => !c)} hitSlop={6}>
          <View style={[styles.checkbox, { borderColor: tint }, consent && { backgroundColor: tint }]}>
            {consent && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.consentText}>
            Для регистрации: согласен с{' '}
            <Text style={[styles.consentLink, { color: tint }]} onPress={() => router.push('/legal/offer')}>
              публичной офертой
            </Text>{' '}
            и даю{' '}
            <Text style={[styles.consentLink, { color: tint }]} onPress={() => router.push('/legal/privacy')}>
              согласие на обработку персональных данных
            </Text>
          </Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable
          style={[styles.submitButton, { backgroundColor: tint, opacity: canSubmit ? 1 : 0.5 }]}
          disabled={!canSubmit}
          onPress={handleSignIn}>
          {pendingAction === 'sign-in' ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitLabel}>Войти</Text>}
        </Pressable>

        <Pressable
          style={[styles.registerButton, { borderColor: tint, opacity: canRegister ? 1 : 0.5 }]}
          disabled={!canRegister}
          onPress={handleRegister}>
          {pendingAction === 'sign-up' ? (
            <ActivityIndicator color={tint} />
          ) : (
            <Text style={[styles.registerLabel, { color: tint }]}>Регистрация</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 28,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.75,
  },
  consentLink: {
    fontWeight: '700',
    opacity: 1,
  },
  errorText: {
    color: '#e5484d',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  registerButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1.5,
  },
  registerLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
