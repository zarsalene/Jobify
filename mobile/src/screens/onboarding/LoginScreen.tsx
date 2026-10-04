import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { Button, Text, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { authErrorKey, logIn } from '@/state/session';

import { AuthLayout, FormError } from './AuthForm';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginScreen() {
  const { t } = useT();
  const { online } = useNetwork();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const passRef = useRef<TextInput>(null);

  async function submit() {
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = t('auth.errEmail');
    if (!password) next.password = t('auth.errPasswordRequired');
    setErrors(next);
    if (Object.keys(next).length) {
      haptics.warning();
      return;
    }
    setBusy(true);
    try {
      await logIn({ email: email.trim().toLowerCase(), password });
      haptics.success();
    } catch (e) {
      haptics.error();
      setErrors({ form: t(authErrorKey(e, 'login')) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passRef.current?.focus()}
      />
      <TextField
        ref={passRef}
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        password
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        maxLength={128}
      />
      <Button title={t('auth.forgotPassword')} variant="plain" size="medium" fullWidth={false} onPress={() => router.push('/forgot')} />
      <FormError message={errors.form} />
      <Button title={t('auth.logIn')} onPress={submit} loading={busy} disabled={!online} haptic="none" />
      {!online ? (
        <Text variant="footnote" color="secondaryLabel" align="center">
          {t('common.offlineExplain')}
        </Text>
      ) : null}
      <Button title={t('auth.noAccount')} variant="plain" size="medium" onPress={() => router.replace('/signup')} />
    </AuthLayout>
  );
}
