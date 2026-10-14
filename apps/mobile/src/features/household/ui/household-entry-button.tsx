import { StyleSheet, View } from 'react-native';

import { useTranslation } from '@/shared/i18n/i18n-provider';
import { IconButton } from '@/shared/ui/controls';
import { type ThemeColor } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import type { SyncState } from '../domain/sync-status';

import { useSharingContext } from './sharing-provider';

const DOT_COLORS: Record<SyncState, ThemeColor> = {
  synced: 'accent',
  syncing: 'blue',
  offline: 'honey',
  error: 'coral',
};

/**
 * The quiet way into the household screen, for a screen header.
 *
 * Renders nothing when sharing is not available in this build, so solo users
 * (and the web build) never see it. Inside a household a small dot on the
 * button shows the sync state without a word of text.
 */
export function HouseholdEntryButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { snapshot } = useSharingContext();

  if (!snapshot.available) return null;

  const { household, sync } = snapshot;
  const status =
    sync.pending > 0
      ? `${t(`sync.${sync.state}`)}, ${t('sync.pending', { count: sync.pending })}`
      : t(`sync.${sync.state}`);

  return (
    <View>
      <IconButton
        icon={household ? 'people' : 'people-outline'}
        accessibilityLabel={
          household
            ? t('household.entry.status', { name: household.name, status })
            : t('household.entry')
        }
        onPress={onPress}
        size={40}
      />
      {household ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.dot,
            { backgroundColor: theme[DOT_COLORS[sync.state]], borderColor: theme.background },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});
