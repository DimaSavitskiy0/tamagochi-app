import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { View, useThemeColor } from '@/components/Themed';

type PasswordFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoComplete?: TextInputProps['autoComplete'];
};

export function PasswordField({ value, onChangeText, placeholder, autoComplete = 'password' }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const borderColor = useThemeColor({ light: '#e2e2e2', dark: 'rgba(255,255,255,0.15)' }, 'background');
  const textColor = useThemeColor({}, 'text');

  return (
    <View style={[styles.wrap, { borderColor }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#888"
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoComplete={autoComplete}
        style={[styles.input, { color: textColor }]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        accessibilityLabel={visible ? 'Скрыть пароль' : 'Показать пароль'}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
});
