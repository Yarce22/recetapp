import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { MENU_SETTINGS_SETTING_KEY } from '@/shared/config/api';
import { InMemorySettingsRepository } from '@/shared/settings/in-memory-settings-repository';

import { DEFAULT_MENU_SETTINGS } from '../../domain/menu-settings';
import { MenuSettingsProvider, useMenuSettings } from '../menu-settings-provider';

function Probe() {
  const { settings, ready, update } = useMenuSettings();
  return (
    <>
      <Text testID="state">{JSON.stringify({ settings, ready })}</Text>
      <Pressable onPress={() => update({ ...settings, period: 'biweekly' })}>
        <Text>go</Text>
      </Pressable>
    </>
  );
}

const read = () => JSON.parse(screen.getByTestId('state').props.children);

async function mount(repository: InMemorySettingsRepository) {
  render(
    <MenuSettingsProvider repository={repository}>
      <Probe />
    </MenuSettingsProvider>,
  );
  await act(async () => {});
}

describe('MenuSettingsProvider', () => {
  it('starts from the defaults when nothing is stored', async () => {
    await mount(new InMemorySettingsRepository());

    expect(read()).toEqual({ settings: DEFAULT_MENU_SETTINGS, ready: true });
  });

  it('restores stored settings', async () => {
    const repository = new InMemorySettingsRepository();
    await repository.set(
      MENU_SETTINGS_SETTING_KEY,
      JSON.stringify({ ...DEFAULT_MENU_SETTINGS, period: 'biweekly', allowRepeats: true }),
    );

    await mount(repository);

    expect(read().settings).toMatchObject({ period: 'biweekly', allowRepeats: true });
  });

  it('falls back to defaults for unreadable storage', async () => {
    const repository = new InMemorySettingsRepository();
    await repository.set(MENU_SETTINGS_SETTING_KEY, '{not json');

    await mount(repository);

    expect(read()).toEqual({ settings: DEFAULT_MENU_SETTINGS, ready: true });
  });

  it('replaces unknown stored values with defaults', async () => {
    const repository = new InMemorySettingsRepository();
    await repository.set(
      MENU_SETTINGS_SETTING_KEY,
      JSON.stringify({ period: 'yearly', region: 'ZZ', slots: ['brunch'] }),
    );

    await mount(repository);

    expect(read().settings).toEqual(DEFAULT_MENU_SETTINGS);
  });

  it('applies a change at once and persists it', async () => {
    const repository = new InMemorySettingsRepository();
    await mount(repository);

    await act(async () => fireEvent.press(screen.getByText('go')));

    expect(read().settings.period).toBe('biweekly');
    const stored = JSON.parse((await repository.get(MENU_SETTINGS_SETTING_KEY)) ?? '{}');
    expect(stored.period).toBe('biweekly');
  });

  it('refuses to be used without a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/MenuSettingsProvider/);
    spy.mockRestore();
  });
});
