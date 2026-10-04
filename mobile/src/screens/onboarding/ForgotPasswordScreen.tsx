import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Icon, Text, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { radii, useTheme } from '@/theme';

import { AuthLayout } from './AuthForm';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The backend has no password-reset endpoint yet. The screen is complete, but
 * it is honest: it does not pretend an email was really sent.
 */
export default function ForgotPasswordScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (!EMAIL_RE.test(email.trim())) {
      setError(t('auth.errEmail'));
      return;
    }
    setError(undefined);
    setSubmitted(true);
  }

  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={error}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      {submitted ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ padding: 14, borderRadius: radii.md + 2, backgroundColor: colors.card, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="envelope" size={18} color="accent" />
            <Text variant="subheadline" style={{ flex: 1 }}>
              {t('auth.linkSent')}
            </Text>
          </View>
          <Text variant="footnote" color="secondaryLabel">
            {t('auth.linkNote')}
          </Text>
        </View>
      ) : null}
      <Button title={t('auth.sendLink')} onPress={submit} />
      <Button title={t('auth.backToLogin')} variant="plain" size="medium" onPress={() => router.replace('/login')} />
    </AuthLayout>
  );
}
