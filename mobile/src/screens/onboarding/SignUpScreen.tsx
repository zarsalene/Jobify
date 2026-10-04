import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { Button, Text, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { authErrorKey, signUp } from '@/state/session';

import { AuthLayout, FormError } from './AuthForm';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUpScreen() {
  const { t } = useT();
  const { online } = useNetwork();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  async function submit() {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('auth.errNameRequired');
    if (!EMAIL_RE.test(email.trim())) next.email = t('auth.errEmail');
    if (password.length < 8) next.password = t('auth.errPasswordShort');
    setErrors(next);
    if (Object.keys(next).length) {
      haptics.warning();
      return;
    }
    setBusy(true);
    try {
      await signUp({ email: email.trim().toLowerCase(), password, full_name: name.trim() });
      haptics.success();
      // The root layout's route guard moves us on to consent once the session exists.
    } catch (e) {
      haptics.error();
      setErrors({ form: t(authErrorKey(e, 'register')) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')}>
      <TextField
        label={t('auth.fullName')}
        value={name}
        onChangeText={setName}
        error={errors.name}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        maxLength={200}
      />
      <TextField
        ref={emailRef}
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
        hint={t('auth.passwordHint')}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        password
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        maxLength={128}
      />
      <FormError message={errors.form} />
      <Button title={t('auth.signUp')} onPress={submit} loading={busy} disabled={!online} haptic="none" />
      {!online ? (
        <Text variant="footnote" color="secondaryLabel" align="center">
          {t('common.offlineExplain')}
        </Text>
      ) : null}
      <Button title={t('auth.haveAccount')} variant="plain" size="medium" onPress={() => router.replace('/login')} />
      <Text variant="footnote" color="secondaryLabel" align="center">
        {t('auth.terms')}
      </Text>
    </AuthLayout>
  );
}

