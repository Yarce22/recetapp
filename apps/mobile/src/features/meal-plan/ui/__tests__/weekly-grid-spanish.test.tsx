import { fireEvent, screen } from '@testing-library/react-native';

import type { MealPlanEntryDto } from '@recetapp/contracts';

import { WeeklyGrid } from '@/features/meal-plan/ui/weekly-grid';
import { renderInLanguage } from '@/shared/i18n/testing/render-in-language';

const WEEK = '2026-09-21';

const dinner: MealPlanEntryDto = {
  date: '2026-09-23',
  slot: 'dinner',
  dishId: 'guiso',
  dishTitle: 'Guiso',
  summary: 'Un guiso.',
  ingredients: ['papa'],
};

async function renderGrid(props: Partial<React.ComponentProps<typeof WeeklyGrid>> = {}) {
  return renderInLanguage(
    <WeeklyGrid
      weekStartDate={WEEK}
      slots={['dinner']}
      entries={[]}
      busyDate={null}
      onSelect={jest.fn()}
      onClear={jest.fn()}
      onRegenerateDay={jest.fn()}
      {...props}
    />,
    'es',
  );
}

describe('WeeklyGrid in Spanish', () => {
  it('names the days of the week in Spanish', async () => {
    await renderGrid();

    for (const day of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      expect(screen.getByText(day)).toBeTruthy();
    }
  });

  it('says an empty slot is empty in Spanish', async () => {
    await renderGrid();

    expect(screen.getAllByText('Nada planificado')).toHaveLength(7);
  });

  it('marks today in Spanish', async () => {
    await renderGrid({ today: '2026-09-22' });

    expect(screen.getByText('Hoy')).toBeTruthy();
  });

  it('labels the actions in Spanish, with the day and the meal', async () => {
    const onClear = jest.fn();
    await renderGrid({ entries: [dinner], onClear });

    expect(screen.getByLabelText('Planificar otra cosa para Lunes')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Quitar cena (Miércoles)'));
    expect(onClear).toHaveBeenCalledWith('2026-09-23', 'dinner');
  });

  it('names the meal in Spanish when several are planned', async () => {
    await renderGrid({ slots: ['breakfast', 'dinner'] });

    expect(screen.getAllByText('desayuno')).toHaveLength(7);
    expect(screen.getAllByText('cena')).toHaveLength(7);
  });
});
