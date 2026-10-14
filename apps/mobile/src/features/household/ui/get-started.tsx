import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTranslation } from '@/shared/i18n/i18n-provider';
import { Button, Card, controlStyles } from '@/shared/ui/controls';
import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import type { SharingService } from '../application/sharing-service';
import { LocalDataDecisionRequired, type LocalDataPolicy } from '../domain/household';
import {
  formatInviteCode,
  INVITE_CODE_LENGTH,
  isCompleteInviteCode,
  normalizeInviteCode,
} from '../domain/invite-code';

import { ErrorNote, Field, Section } from './household-parts';
import { useAction } from './use-action';

/**
 * What a device that is not in a household sees: create one, or join one with
 * a code. Joining with data already on the device asks what to do with it first.
 */
export function GetStarted({ service }: { service: SharingService }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [askingAboutData, setAskingAboutData] = useState(false);
  const create = useAction();
  const join = useAction();

  const busy = create.busy || join.busy;
  const ownName = displayName.trim() || null;
  const inputStyle = [
    controlStyles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];
  // Inside a card the field must not melt into the card, so it takes the page color.
  const cardInputStyle = [
    controlStyles.input,
    { backgroundColor: theme.background, color: theme.text },
  ];

  function changeCode(text: string) {
    // Eight characters at most, grouped as they are typed.
    setCode(formatInviteCode(normalizeInviteCode(text).slice(0, INVITE_CODE_LENGTH)));
  }

  function createHousehold() {
    void create.run(async () => {
      await service.createHousehold(name.trim(), ownName);
    });
  }

  function joinHousehold(localData?: LocalDataPolicy) {
    setAskingAboutData(false);
    void join.run(
      async () => {
        await service.joinHousehold(normalizeInviteCode(code), {
          displayName: ownName,
          ...(localData ? { localData } : {}),
        });
      },
      (cause) => {
        if (!(cause instanceof LocalDataDecisionRequired)) return false;
        setAskingAboutData(true);
        return true;
      },
    );
  }

  const codeStarted = code.length > 0;
  const codeComplete = isCompleteInviteCode(code);

  return (
    <View style={styles.root}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('household.intro')}
      </ThemedText>

      <Field label={t('household.displayName.label')} hint={t('household.displayName.hint')}>
        <TextInput
          accessibilityLabel={t('household.displayName.label')}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('household.displayName.placeholder')}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="words"
          maxLength={40}
          style={inputStyle}
        />
      </Field>

      <Card>
        <Section title={t('household.create.title')} hint={t('household.create.hint')}>
          <Field label={t('household.name.label')}>
            <TextInput
              accessibilityLabel={t('household.name.label')}
              value={name}
              onChangeText={setName}
              placeholder={t('household.name.placeholder')}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="sentences"
              maxLength={60}
              style={cardInputStyle}
            />
          </Field>
          {create.error ? <ErrorNote text={create.error} /> : null}
          <Button
            label={create.busy ? t('household.working') : t('household.create.action')}
            accessibilityLabel={t('household.create.action')}
            icon="add-circle-outline"
            disabled={busy || name.trim() === ''}
            onPress={createHousehold}
          />
        </Section>
      </Card>

      <Card>
        <Section title={t('household.join.title')} hint={t('household.join.hint')}>
          <Field label={t('household.code.label')}>
            <TextInput
              accessibilityLabel={t('household.code.label')}
              value={code}
              onChangeText={changeCode}
              placeholder={t('household.code.placeholder')}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              style={[...cardInputStyle, styles.codeInput]}
            />
          </Field>
          {codeStarted && !codeComplete ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('household.code.incomplete')}
            </ThemedText>
          ) : null}

          {askingAboutData ? (
            <Card tone="butter">
              <View style={styles.decision}>
                <ThemedText type="subtitle" style={{ color: theme.butterInk }}>
                  {t('household.localData.title')}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.butterInk }}>
                  {t('household.localData.body')}
                </ThemedText>
                <Button
                  label={t('household.localData.upload')}
                  icon="cloud-upload-outline"
                  disabled={busy}
                  onPress={() => joinHousehold('upload')}
                />
                <ThemedText type="small" style={{ color: theme.butterInk }}>
                  {t('household.localData.upload.hint')}
                </ThemedText>
                <Button
                  label={t('household.localData.discard')}
                  variant="soft"
                  tone="peach"
                  icon="trash-outline"
                  disabled={busy}
                  onPress={() => joinHousehold('discard')}
                />
                <ThemedText type="small" style={{ color: theme.butterInk }}>
                  {t('household.localData.discard.hint')}
                </ThemedText>
                <Button
                  label={t('household.localData.cancel')}
                  variant="soft"
                  tone="lavender"
                  disabled={busy}
                  onPress={() => setAskingAboutData(false)}
                />
              </View>
            </Card>
          ) : null}

          {join.error ? <ErrorNote text={join.error} /> : null}
          <Button
            label={join.busy ? t('household.working') : t('household.join.action')}
            accessibilityLabel={t('household.join.action')}
            variant="soft"
            tone="mint"
            icon="enter-outline"
            disabled={busy || !codeComplete || askingAboutData}
            onPress={() => joinHousehold()}
          />
        </Section>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  codeInput: { letterSpacing: 2, textAlign: 'center' },
  decision: { gap: Spacing.two },
});
