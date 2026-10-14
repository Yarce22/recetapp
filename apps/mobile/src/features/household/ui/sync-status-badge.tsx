import { StyleSheet, View } from 'react-native';

import { useTranslation } from '@/shared/i18n/i18n-provider';
import { Badge } from '@/shared/ui/controls';
import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing, type Tone } from '@/shared/ui/theme';

import type { SyncState, SyncStatus } from '../domain/sync-status';

const TONES: Record<SyncState, Tone> = {
  synced: 'mint',
  syncing: 'sky',
  offline: 'butter',
  error: 'warning',
};

/** The sync state as a small pill, plus how many changes are still waiting. */
export function SyncStatusBadge({ sync }: { sync: Pick<SyncStatus, 'state' | 'pending'> }) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Badge label={t(`sync.${sync.state}`)} tone={TONES[sync.state]} />
      {sync.pending > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('sync.pending', { count: sync.pending })}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
});
