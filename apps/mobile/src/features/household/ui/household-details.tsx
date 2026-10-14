import { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { useI18n } from '@/shared/i18n/i18n-provider';
import { Badge, Button, Card } from '@/shared/ui/controls';
import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import type { SharingService } from '../application/sharing-service';
import type { Household, Invite, LeavePolicy, Member } from '../domain/household';
import { formatInviteCode } from '../domain/invite-code';
import type { SyncStatus } from '../domain/sync-status';

import { describeSharingErrorKind } from './describe-sharing-error';
import { formatMoment } from './format-moment';
import { ErrorNote, Section } from './household-parts';
import { SyncStatusBadge } from './sync-status-badge';
import { useAction } from './use-action';

type Loadable<T> = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; items: T[] };

/** Loads a list when the screen opens and again when asked to retry. */
function useList<T>(load: () => Promise<T[]>) {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const items = await load();
        if (!cancelled) setState({ status: 'ready', items });
      } catch {
        if (!cancelled) setState({ status: 'failed' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  return { state, retry, setState };
}

export type HouseholdDetailsProps = {
  household: Household;
  sync: SyncStatus;
  service: SharingService;
};

/** The household this device belongs to: members, invites, sync and leaving. */
export function HouseholdDetails({ household, sync, service }: HouseholdDetailsProps) {
  const theme = useTheme();

  return (
    <View style={styles.root}>
      <Card tone="mint">
        <View style={styles.summary}>
          <ThemedText type="heading" style={{ color: theme.mintInk }}>
            {household.name}
          </ThemedText>
          <SyncStatusBadge sync={sync} />
        </View>
      </Card>

      <Members service={service} />
      <Invites service={service} />
      <SyncSection sync={sync} />
      <Leave service={service} />
    </View>
  );
}

function Members({ service }: { service: SharingService }) {
  const { t, formatDate } = useI18n();
  const load = useCallback(() => service.listMembers(), [service]);
  const { state, retry } = useList<Member>(load);

  return (
    <Section title={t('household.members.title')}>
      {state.status === 'failed' ? (
        <View style={styles.stack}>
          <ErrorNote text={t('household.members.error')} />
          <Button
            label={t('household.retry')}
            variant="soft"
            tone="lavender"
            icon="refresh"
            onPress={retry}
          />
        </View>
      ) : null}
      {state.status === 'ready'
        ? state.items.map((member) => (
            <Card key={member.userId}>
              <View style={styles.memberRow}>
                <View style={styles.memberText}>
                  <ThemedText type="smallBold">
                    {member.displayName ?? t('household.member.unnamed')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('household.member.joined', {
                      date: formatDate(member.joinedAt.slice(0, 10)),
                    })}
                  </ThemedText>
                </View>
                <View style={styles.badges}>
                  {member.isYou ? <Badge label={t('household.member.you')} tone="sky" /> : null}
                  {member.role === 'owner' ? (
                    <Badge label={t('household.member.owner')} tone="lavender" />
                  ) : null}
                </View>
              </View>
            </Card>
          ))
        : null}
    </Section>
  );
}

function Invites({ service }: { service: SharingService }) {
  const { t, formatDate } = useI18n();
  const load = useCallback(() => service.listInvites(), [service]);
  const { state, setState } = useList<Invite>(load);
  const generate = useAction();
  const revoke = useAction();

  function generateCode() {
    void generate.run(async () => {
      const created = await service.createInvite();
      setState((current) => ({
        status: 'ready',
        items: [
          created,
          ...(current.status === 'ready' ? current.items.filter((i) => i.id !== created.id) : []),
        ],
      }));
    });
  }

  function revokeCode(invite: Invite) {
    void revoke.run(async () => {
      await service.revokeInvite(invite.id);
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', items: current.items.filter((i) => i.id !== invite.id) }
          : current,
      );
    });
  }

  async function shareCode(invite: Invite) {
    try {
      await Share.share({
        message: t('household.invite.shareMessage', { code: formatInviteCode(invite.code) }),
      });
    } catch {
      // Closing the share sheet or having no app to share with is not a failure to report.
    }
  }

  const invites = state.status === 'ready' ? state.items : [];

  return (
    <Section title={t('household.invite.title')} hint={t('household.invite.hint')}>
      {generate.error ? <ErrorNote text={generate.error} /> : null}
      <Button
        label={generate.busy ? t('household.working') : t('household.invite.create')}
        accessibilityLabel={t('household.invite.create')}
        icon="key-outline"
        disabled={generate.busy}
        onPress={generateCode}
      />

      {state.status === 'failed' ? <ErrorNote text={t('household.invite.error')} /> : null}
      {revoke.error ? <ErrorNote text={revoke.error} /> : null}

      {state.status === 'ready' ? (
        invites.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('household.invite.none')}
          </ThemedText>
        ) : (
          <View style={styles.stack}>
            <ThemedText type="smallBold">{t('household.invite.active')}</ThemedText>
            {invites.map((invite) => {
              const code = formatInviteCode(invite.code);
              return (
                <Card key={invite.id}>
                  <View style={styles.stack}>
                    {/* Selectable, so a long press copies it: there is no clipboard module in the app. */}
                    <ThemedText type="heading" selectable testID="invite-code" style={styles.code}>
                      {code}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('household.invite.expires', {
                        when: formatMoment(invite.expiresAt, formatDate),
                      })}
                    </ThemedText>
                    <View style={styles.actions}>
                      <Button
                        label={t('household.invite.share')}
                        accessibilityLabel={t('household.invite.shareLabel', { code })}
                        variant="soft"
                        tone="mint"
                        icon="share-outline"
                        onPress={() => void shareCode(invite)}
                        style={styles.action}
                      />
                      <Button
                        label={t('household.invite.revoke')}
                        accessibilityLabel={t('household.invite.revokeLabel', { code })}
                        variant="soft"
                        tone="peach"
                        icon="close-circle-outline"
                        disabled={revoke.busy}
                        onPress={() => revokeCode(invite)}
                        style={styles.action}
                      />
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )
      ) : null}
    </Section>
  );
}

function SyncSection({ sync }: { sync: SyncStatus }) {
  const { t, formatDate } = useI18n();

  return (
    <Section title={t('household.sync.title')}>
      <Card>
        <View style={styles.stack}>
          <ThemedText type="small" themeColor="textSecondary">
            {sync.lastSyncedAt
              ? t('household.sync.lastSynced', {
                  when: formatMoment(sync.lastSyncedAt, formatDate),
                })
              : t('household.sync.never')}
          </ThemedText>
          {sync.error && sync.state !== 'synced' ? (
            <ThemedText type="small">{describeSharingErrorKind(sync.error, t)}</ThemedText>
          ) : null}
          {sync.rejected > 0 ? (
            <ThemedText type="small">
              {t('household.sync.rejected', { count: sync.rejected })}
            </ThemedText>
          ) : null}
        </View>
      </Card>
    </Section>
  );
}

function Leave({ service }: { service: SharingService }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);
  const leave = useAction();

  function leaveWith(localData: LeavePolicy) {
    void leave.run(async () => {
      await service.leaveHousehold({ localData });
    });
  }

  return (
    <View style={styles.stack}>
      {leave.error ? <ErrorNote text={leave.error} /> : null}
      {confirming ? (
        <Card tone="peach">
          <View style={styles.stack}>
            <ThemedText
              type="subtitle"
              accessibilityRole="header"
              style={{ color: theme.peachInk }}
            >
              {t('household.leave.title')}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.peachInk }}>
              {t('household.leave.body')}
            </ThemedText>
            <Button
              label={t('household.leave.keep')}
              icon="copy-outline"
              disabled={leave.busy}
              onPress={() => leaveWith('keep')}
            />
            <Button
              label={t('household.leave.discard')}
              variant="soft"
              tone="warning"
              icon="trash-outline"
              disabled={leave.busy}
              onPress={() => leaveWith('discard')}
            />
            <Button
              label={t('household.leave.cancel')}
              variant="soft"
              tone="lavender"
              disabled={leave.busy}
              onPress={() => setConfirming(false)}
            />
          </View>
        </Card>
      ) : (
        <Button
          label={t('household.leave.action')}
          variant="soft"
          tone="peach"
          icon="exit-outline"
          onPress={() => setConfirming(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.four },
  summary: { gap: Spacing.two },
  stack: { gap: Spacing.two },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  memberText: { flex: 1, gap: Spacing.half },
  badges: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap', justifyContent: 'flex-end' },
  code: { letterSpacing: 2 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1, minHeight: 46, paddingHorizontal: Spacing.two },
});
