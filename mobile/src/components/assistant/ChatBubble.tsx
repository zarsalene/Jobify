import { router } from 'expo-router';
import { View } from 'react-native';

import type { ChatMessage } from '@/api/types-assistant';
import { Button, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { acceptProposal } from '@/state/assistant';
import { radii, useTheme } from '@/theme';

import { AiFooter } from './Bits';
import { TaskCard } from './TaskCard';

/** One message: a user bubble (end side) or an assistant bubble (start side) with its sources and any task card. */
export function ChatBubble({ message }: { message: ChatMessage }) {
  const { t } = useT();
  const { colors } = useTheme();

  if (message.role === 'user') {
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <View
          accessible
          accessibilityLabel={`${t('assistant.you')}: ${message.text}`}
          style={{ maxWidth: '85%', backgroundColor: colors.accent, borderRadius: radii.xl, borderEndEndRadius: 6, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Text variant="body" color="onAccent" selectable>
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  const proposal = message.proposal;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ alignItems: 'flex-start' }}>
        <View
          accessible
          accessibilityLabel={`${t('assistant.assistantSays')}: ${message.text}`}
          style={{ maxWidth: '92%', backgroundColor: colors.card, borderRadius: radii.xl, borderStartStartRadius: 6, padding: 14, gap: 10 }}>
          <Text variant="body" selectable>
            {message.text}
          </Text>
          {message.sources?.length ? <AiFooter sources={message.sources} /> : null}
          {proposal && proposal.kind !== 'interview_prep' ? (
            <Button title={t('assistant.planThis')} variant="tinted" size="medium" icon="list" onPress={() => acceptProposal(message.id)} />
          ) : null}
          {proposal?.kind === 'interview_prep' ? (
            <Button title={t('assistant.openInterview')} variant="tinted" size="medium" icon="mic" onPress={() => router.push('/interview-prep')} />
          ) : null}
          {message.noCv ? <Button title={t('assistant.reviewCv')} variant="tinted" size="medium" icon="document" onPress={() => router.push('/cv')} /> : null}
        </View>
      </View>
      {message.taskId ? <TaskCard id={message.taskId} /> : null}
    </View>
  );
}
