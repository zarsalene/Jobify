import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import type { ChatMessage, TaskKind } from '@/api/types-assistant';
import { ChatBubble } from '@/components/assistant/ChatBubble';
import { TASK_ICON } from '@/components/assistant/meta';
import { OfflineHint } from '@/components/states';
import { Chip, Icon, Padded, Row, Screen, Section, Text, TextField } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { assistant, ensureAssistantHydrated, proposeTask, sendUserMessage } from '@/state/assistant';
import { MIN_TOUCH, PAGE_MARGIN, useTheme } from '@/theme';

const SUGGESTIONS: { kind: TaskKind | 'interview_prep'; label: TKey; hint: TKey }[] = [
  { kind: 'improve_cv', label: 'assistant.task_improve_cv', hint: 'assistant.hint_improve_cv' },
  { kind: 'cover_letter', label: 'assistant.task_cover_letter', hint: 'assistant.hint_cover_letter' },
  { kind: 'linkedin_profile', label: 'assistant.task_linkedin_profile', hint: 'assistant.hint_linkedin_profile' },
  { kind: 'linkedin_post', label: 'assistant.task_linkedin_post', hint: 'assistant.hint_linkedin_post' },
  { kind: 'interview_prep', label: 'assistant.task_interview_prep', hint: 'assistant.hint_interview_prep' },
];

/** One exchange: a user message and the assistant's replies to it. Shown newest first so the latest is always next to the composer. */
function groupMessages(messages: ChatMessage[]): ChatMessage[][] {
  const groups: ChatMessage[][] = [];
  messages.forEach((m) => {
    if (m.role === 'user' || groups.length === 0) groups.push([m]);
    else groups[groups.length - 1].push(m);
  });
  return groups.reverse();
}

export default function AssistantScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const { online } = useNetwork();
  const messages = assistant.use((s) => s.messages);
  const thinking = assistant.use((s) => s.thinking);
  const [text, setText] = useState('');

  useEffect(() => {
    void ensureAssistantHydrated();
  }, []);

  const groups = useMemo(() => groupMessages(messages), [messages]);
  const canSend = online && !thinking && text.trim().length > 0;

  function submit() {
    if (!canSend) return;
    if (sendUserMessage(text)) {
      haptics.tap();
      setText('');
    }
  }

  function startSuggestion(kind: TaskKind | 'interview_prep') {
    if (kind === 'interview_prep') {
      router.push('/interview-prep');
      return;
    }
    proposeTask(kind);
  }

  const tools: { title: TKey; subtitle: TKey; icon: Parameters<typeof Row>[0]['icon']; href: string }[] = [
    { title: 'assistant.toolCv', subtitle: 'assistant.toolCvHint', icon: 'document', href: '/cv-optimizer' },
    { title: 'assistant.toolLetter', subtitle: 'assistant.toolLetterHint', icon: 'envelope', href: '/cover-letter' },
    { title: 'assistant.toolLinkedIn', subtitle: 'assistant.toolLinkedInHint', icon: 'briefcaseUser', href: '/linkedin' },
    { title: 'assistant.toolPost', subtitle: 'assistant.toolPostHint', icon: 'megaphone', href: '/linkedin-post' },
    { title: 'assistant.toolInterview', subtitle: 'assistant.toolInterviewHint', icon: 'mic', href: '/interview-prep' },
  ];

  return (
    <Screen tabs>
      {/* Honest framing: what the assistant is, and what it will not do without you. */}
      <Padded style={{ marginTop: 8, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Icon name="shield" size={18} color="greenText" />
        <Text variant="subheadline" color="secondaryLabel" style={{ flex: 1 }}>
          {t('assistant.intro')}
        </Text>
      </Padded>

      {/* Composer */}
      <Padded style={{ marginTop: 16 }}>
        <TextField
          label={t('assistant.askLabel')}
          placeholder={t('assistant.askPlaceholder')}
          value={text}
          onChangeText={setText}
          returnKeyType="send"
          blurOnSubmit
          maxLength={500}
          onSubmitEditing={submit}
          trailing={
            <Pressable
              onPress={submit}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={t('assistant.send')}
              accessibilityState={{ disabled: !canSend }}
              hitSlop={4}
              style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: canSend ? colors.accent : colors.fill,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name="send" size={16} color={canSend ? 'onAccent' : 'tertiaryLabel'} weight="semibold" />
              </View>
            </Pressable>
          }
        />
        <OfflineHint />
      </Padded>

      {/* Suggested tasks */}
      {messages.length === 0 ? (
        <Section header={t('assistant.suggested')} footer={t('assistant.suggestedFooter')} separatorInset={60}>
          {SUGGESTIONS.map((s) => (
            <Row
              key={s.kind}
              title={t(s.label)}
              subtitle={t(s.hint)}
              icon={s.kind === 'interview_prep' ? 'mic' : TASK_ICON[s.kind]}
              onPress={() => startSuggestion(s.kind)}
            />
          ))}
        </Section>
      ) : (
        <View style={{ marginTop: 16 }}>
          <Text variant="footnote" color="secondaryLabel" style={{ marginHorizontal: PAGE_MARGIN + 16, marginBottom: 4, textTransform: 'uppercase' }}>
            {t('assistant.suggested')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_MARGIN, gap: 8, paddingVertical: 6 }}>
            {SUGGESTIONS.map((s) => (
              <Chip
                key={s.kind}
                label={t(s.label)}
                icon={s.kind === 'interview_prep' ? 'mic' : TASK_ICON[s.kind]}
                onPress={() => startSuggestion(s.kind)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Conversation */}
      {messages.length > 0 || thinking ? (
        <Padded style={{ marginTop: 20, gap: 20 }}>
          <Text variant="footnote" color="secondaryLabel" style={{ textTransform: 'uppercase', marginHorizontal: 16 }} accessibilityRole="header">
            {t('assistant.conversation')}
          </Text>
          {thinking ? (
            <View accessible accessibilityLiveRegion="polite" accessibilityLabel={t('assistant.thinking')} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 4 }}>
              <ActivityIndicator color={colors.secondaryLabel} />
              <Text variant="subheadline" color="secondaryLabel">
                {t('assistant.thinking')}
              </Text>
            </View>
          ) : null}
          {groups.map((g) => (
            <View key={g[0].id} style={{ gap: 10 }}>
              {g.map((m) => (
                <ChatBubble key={m.id} message={m} />
              ))}
            </View>
          ))}
        </Padded>
      ) : null}

      {/* Tools, always reachable directly */}
      <Section header={t('assistant.toolsHeader')} footer={t('assistant.toolsFooter')} separatorInset={60} style={{ marginTop: 28 }}>
        {tools.map((tool) => (
          <Row key={tool.href} title={t(tool.title)} subtitle={t(tool.subtitle)} icon={tool.icon} onPress={() => router.push(tool.href)} />
        ))}
      </Section>
    </Screen>
  );
}
