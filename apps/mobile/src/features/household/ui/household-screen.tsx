import { ScrollView, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/shared/i18n/i18n-provider';
import { Button, Card, IconButton, Screen, ScreenHeader } from '@/shared/ui/controls';
import { Skeleton } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import { GetStarted } from './get-started';
import { HouseholdDetails } from './household-details';
import { useSharingContext } from './sharing-provider';

/**
 * Everything about sharing, on one screen: create or join a household, then
 * members, invites, sync status and leaving.
 */
export function HouseholdScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { ready, snapshot, service } = useSharingContext();

  let body;
  if (!snapshot.available) {
    body = (
      <ThemedText type="small" themeColor="textSecondary">
        {t('household.error.unavailable')}
      </ThemedText>
    );
  } else if (!ready || !service) {
    body = (
      <View style={styles.loading} accessibilityLabel={t('household.loading')}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('household.loading')}
        </ThemedText>
        <Skeleton height={96} radius={Radius.xl} />
        <Skeleton height={64} radius={Radius.xl} />
      </View>
    );
  } else {
    body = (
      <View style={styles.body}>
        {snapshot.membershipLost ? (
          <MembershipLost onDismiss={() => service.dismissMembershipLost()} />
        ) : null}
        {snapshot.household ? (
          <HouseholdDetails household={snapshot.household} sync={snapshot.sync} service={service} />
        ) : (
          <GetStarted service={service} />
        )}
      </View>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <ScreenHeader
          eyebrow={t('household.eyebrow')}
          title={t('household.title')}
          action={
            <IconButton icon="close" accessibilityLabel={t('household.close')} onPress={onClose} />
          }
        />
        <View style={styles.content}>{body}</View>
      </ScrollView>
    </Screen>
  );
}

function MembershipLost({ onDismiss }: { onDismiss: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View accessibilityRole="alert">
      <Card tone="warning">
        <View style={styles.lost}>
          <ThemedText type="subtitle" style={{ color: theme.warningInk }}>
            {t('household.lost.title')}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.warningInk }}>
            {t('household.lost.body')}
          </ThemedText>
          <Button
            label={t('household.lost.dismiss')}
            variant="soft"
            tone="peach"
            onPress={onDismiss}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: Spacing.six },
  content: { paddingHorizontal: Spacing.four },
  body: { gap: Spacing.three },
  loading: { gap: Spacing.three },
  lost: { gap: Spacing.two },
});
