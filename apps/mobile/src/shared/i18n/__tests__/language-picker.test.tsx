import { fireEvent, render, screen } from '@testing-library/react-native';

import { LanguagePicker } from '@/shared/i18n/language-picker';

function renderPicker(props: Partial<React.ComponentProps<typeof LanguagePicker>> = {}) {
  const onSelect = jest.fn();
  render(<LanguagePicker suggested="en" selected={null} onSelect={onSelect} {...props} />);
  return { onSelect };
}

describe('LanguagePicker', () => {
  it('offers each language labelled in its own language', () => {
    renderPicker();

    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('Español')).toBeTruthy();
  });

  it('asks in both languages, so either reader can find it', () => {
    renderPicker();

    expect(screen.getByText('Choose your language')).toBeTruthy();
    expect(screen.getByText('Elige tu idioma')).toBeTruthy();
  });

  it('reports the language the user taps', () => {
    const { onSelect } = renderPicker();

    fireEvent.press(screen.getByText('Español'));

    expect(onSelect).toHaveBeenCalledWith('es');
  });

  it('marks the suggested language without choosing it', () => {
    const { onSelect } = renderPicker({ suggested: 'es' });

    expect(screen.getAllByText('Sugerido')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /Español/ })).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows the current language as selected when reopened later', () => {
    renderPicker({ selected: 'es' });

    expect(screen.getByRole('radio', { name: /English/, selected: false })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Español/, selected: true })).toBeTruthy();
  });

  it('offers a way out only when there is somewhere to go back to', () => {
    renderPicker();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();

    const onClose = jest.fn();
    renderPicker({ onClose });
    fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
