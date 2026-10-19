import { fireEvent, screen } from '@testing-library/react-native';

import type { Language } from '@recetapp/contracts';

import { renderInLanguage } from '@/shared/i18n/testing/render-in-language';

import { DEFAULT_MENU_SETTINGS, type MenuSettings } from '../../domain/menu-settings';
import { MenuSettingsPanel } from '../menu-settings-panel';

async function renderPanel(
  settings: MenuSettings = DEFAULT_MENU_SETTINGS,
  language: Language = 'en',
) {
  const onChange = jest.fn();
  await renderInLanguage(<MenuSettingsPanel settings={settings} onChange={onChange} />, language);
  return onChange;
}

const checked = (label: string) => screen.getByLabelText(label).props.accessibilityState.checked;

describe('MenuSettingsPanel', () => {
  it('shows the current choices', async () => {
    await renderPanel({ ...DEFAULT_MENU_SETTINGS, slots: ['dinner'], allowRepeats: true });

    expect(checked('Allow repeated dishes')).toBe(true);
    expect(checked('Include ingredients with the menu')).toBe(false);
    expect(checked('Plan dinner')).toBe(true);
    expect(checked('Plan lunch')).toBe(false);
    expect(screen.getByText('Colombia')).toBeTruthy();
  });

  it('switches the menu period', async () => {
    const onChange = await renderPanel();

    fireEvent.press(screen.getByText('Two weeks'));

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_MENU_SETTINGS, period: 'biweekly' });
  });

  it('toggles repeated dishes and ingredients', async () => {
    const onChange = await renderPanel();

    fireEvent.press(screen.getByLabelText('Allow repeated dishes'));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_MENU_SETTINGS, allowRepeats: true });

    fireEvent.press(screen.getByLabelText('Include ingredients with the menu'));
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_MENU_SETTINGS,
      includeIngredients: true,
    });
  });

  it('toggles meals', async () => {
    const onChange = await renderPanel();

    fireEvent.press(screen.getByLabelText('Plan lunch'));

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_MENU_SETTINGS,
      slots: ['breakfast', 'dinner'],
    });
  });

  it('does not drop the last meal', async () => {
    const only: MenuSettings = { ...DEFAULT_MENU_SETTINGS, slots: ['dinner'] };
    const onChange = await renderPanel(only);

    fireEvent.press(screen.getByLabelText('Plan dinner'));

    expect(onChange).toHaveBeenLastCalledWith(only);
  });

  it('selects the region', async () => {
    const onChange = await renderPanel();

    fireEvent.press(screen.getByLabelText('Region: Colombia'));

    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_MENU_SETTINGS, region: 'CO' });
  });

  it('speaks Spanish', async () => {
    await renderPanel(DEFAULT_MENU_SETTINGS, 'es');

    expect(screen.getByText('Dos semanas')).toBeTruthy();
    expect(screen.getByLabelText('Permitir platos repetidos')).toBeTruthy();
    expect(screen.getByLabelText('Región: Colombia')).toBeTruthy();
  });
});
