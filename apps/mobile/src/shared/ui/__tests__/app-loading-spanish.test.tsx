import { screen } from '@testing-library/react-native';

import { renderInLanguage } from '@/shared/i18n/testing/render-in-language';
import { AppLoading } from '@/shared/ui/app-loading';
import { ScreenPlaceholder } from '@/shared/ui/screen-placeholder';

describe('shared UI in Spanish', () => {
  it('shows the loading screen in Spanish', async () => {
    await renderInLanguage(<AppLoading />, 'es');

    expect(screen.getByText('Revisando tu despensa…')).toBeTruthy();
    expect(screen.getByText('Cocina con lo que ya tienes')).toBeTruthy();
  });

  it('lets the caller pass its own message', async () => {
    await renderInLanguage(<AppLoading message="Preparando la cocina…" />, 'es');

    expect(screen.getByText('Preparando la cocina…')).toBeTruthy();
  });

  it('shows the loading screen in English by default', async () => {
    await renderInLanguage(<AppLoading />, 'en');

    expect(screen.getByText('Checking your pantry…')).toBeTruthy();
    expect(screen.getByText('Cook what you already have')).toBeTruthy();
  });

  it('translates the placeholder note', async () => {
    await renderInLanguage(
      <ScreenPlaceholder title="Despensa" description="Lo que tienes." phase="Fase 1" />,
      'es',
    );

    expect(screen.getByText('Llega en Fase 1')).toBeTruthy();
  });
});
