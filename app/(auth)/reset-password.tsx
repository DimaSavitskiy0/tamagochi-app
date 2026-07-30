import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { PasswordField } from '@/components/auth/PasswordField';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';

export default function ResetPasswordScreen() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit =
    email.trim().length > 3 &&
    code.trim().length === 6 &&
    newPassword.length >= 6 &&
    newPassword === confirmPassword &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await api.resetPassword(email.trim(), code.trim(), newPassword);
      setDone(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось сбросить пароль');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Пароль изменён</Text>
        <Text style={styles.subtitle}>Теперь можно войти с новым паролем</Text>
        <Pressable
          style={[styles.submitButton, { backgroundColor: tint }]}
          onPress={() => router.replace('/sign-in')}>
          <Text style={styles.submitLabel}>Войти</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.title}>Новый пароль</Text>
        <Text style={styles.subtitle}>Введите код из письма и новый пароль для {email || 'вашего аккаунта'}</Text>

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
        <TextInput
          value={code}
          onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
          placeholder="Код из письма (6 цифр)"
          placeholderTextColor="#888"
          keyboardType="number-pad"
          maxLength={6}
          style={[styles.input, { borderColor, color: textColor }]}
        />
        <PasswordField value={newPassword} onChangeText={setNewPassword} placeholder="Новый пароль" autoComplete="password-new" />
        <PasswordField
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Повторите пароль"
          autoComplete="password-new"
        />
        {confirmPassword.length > 0 && newPassword !== confirmPassword ? (
          <Text style={styles.errorText}>Пароли не совпадают</Text>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable
          style={[styles.submitButton, { backgroundColor: tint, opacity: canSubmit ? 1 : 0.5 }]}
          disabled={!canSubmit}
          onPress={handleSubmit}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitLabel}>Сохранить пароль</Text>}
        </Pressable>

        <Pressable
          style={styles.backLink}
          onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })}
          hitSlop={6}>
          <Text style={[styles.backLinkText, { color: tint }]}>Отправить код ещё раз</Text>
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
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 19,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
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
  backLink: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 6,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
