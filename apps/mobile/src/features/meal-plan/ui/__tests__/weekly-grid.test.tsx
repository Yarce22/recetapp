import { fireEvent, render, screen } from '@testing-library/react-native';

import type { MealPlanEntryDto } from '@recetapp/contracts';

import { WeeklyGrid } from '@/features/meal-plan/ui/weekly-grid';

const WEEK = '2026-09-21';

const entry = (date: string, title: string): MealPlanEntryDto => ({
  date,
  slot: 'dinner',
  dishId: title.toLowerCase().replace(/\s+/g, '-'),
  dishTitle: title,
  summary: `A dish called ${title}`,
  ingredients: ['tomato'],
});

function renderGrid(props: Partial<React.ComponentProps<typeof WeeklyGrid>> = {}) {
  return render(
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
  );
}

describe('WeeklyGrid', () => {
  it('shows the seven days of the week', () => {
    renderGrid();

    for (const day of [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]) {
      expect(screen.getByText(day)).toBeTruthy();
    }
  });

  it('puts each dish on its own day', () => {
    renderGrid({ entries: [entry('2026-09-23', 'Stew')] });

    expect(screen.getByText('Stew')).toBeTruthy();
  });

  it('says a slot is empty rather than showing a blank row', () => {
    renderGrid();

    expect(screen.getAllByText('Nothing planned')).toHaveLength(7);
  });

  it('opens the dish when its cell is tapped', () => {
    const onSelect = jest.fn();
    renderGrid({ entries: [entry('2026-09-21', 'Pasta')], onSelect });

    fireEvent.press(screen.getByText('Pasta'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ dishTitle: 'Pasta' }));
  });

  it('clears a single meal', () => {
    const onClear = jest.fn();
    renderGrid({ entries: [entry('2026-09-21', 'Pasta')], onClear });

    fireEvent.press(screen.getByLabelText('Clear dinner on Monday'));

    expect(onClear).toHaveBeenCalledWith('2026-09-21', 'dinner');
  });

  it('regenerates one day without touching the others', () => {
    const onRegenerateDay = jest.fn();
    renderGrid({ onRegenerateDay });

    fireEvent.press(screen.getByLabelText('Plan something else for Wednesday'));

    expect(onRegenerateDay).toHaveBeenCalledWith('2026-09-23');
  });

  it('does not offer to clear a slot that is already empty', () => {
    renderGrid();

    expect(screen.queryByLabelText('Clear dinner on Monday')).toBeNull();
  });

  it('disables the day being regenerated, so it cannot be asked twice at once', () => {
    const onRegenerateDay = jest.fn();
    renderGrid({ busyDate: '2026-09-23', onRegenerateDay });

    fireEvent.press(screen.getByLabelText('Plan something else for Wednesday'));

    expect(onRegenerateDay).not.toHaveBeenCalled();
  });

  it('renders a row per slot when more than one meal is planned', () => {
    renderGrid({ slots: ['lunch', 'dinner'] });

    expect(screen.getAllByText('lunch')).toHaveLength(7);
    expect(screen.getAllByText('dinner')).toHaveLength(7);
  });
});
