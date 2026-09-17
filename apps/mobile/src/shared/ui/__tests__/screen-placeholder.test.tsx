import { render, screen } from '@testing-library/react-native';

import { ScreenPlaceholder } from '@/shared/ui/screen-placeholder';

describe('ScreenPlaceholder', () => {
  it('shows the title, the description and the roadmap phase', () => {
    render(
      <ScreenPlaceholder title="Pantry" description="What you have at home." phase="Phase 1" />,
    );

    expect(screen.getByText('Pantry')).toBeTruthy();
    expect(screen.getByText('What you have at home.')).toBeTruthy();
    expect(screen.getByText('Arrives in Phase 1')).toBeTruthy();
  });
});
