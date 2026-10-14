import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SharingTestProvider, sharingValue } from '@/features/household/testing/fake-sharing';

import { InMemoryShoppingChecksRepository } from '../../infrastructure/in-memory-shopping-checks-repository';
import { useShoppingChecks } from '../use-shopping-checks';

const mockRepository = { current: new InMemoryShoppingChecksRepository() };
jest.mock('../../infrastructure/create-shopping-checks-repository', () => ({
  createShoppingChecksRepository: jest.fn(async () => mockRepository.current),
}));

function setup(revision = 0) {
  let current = revision;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SharingTestProvider value={sharingValue({ sync: { remoteRevision: current } })}>
      {children}
    </SharingTestProvider>
  );
  const view = renderHook(() => useShoppingChecks(), { wrapper });
  return {
    ...view,
    bump(next: number) {
      current = next;
      view.rerender({});
    },
  };
}

describe('useShoppingChecks', () => {
  beforeEach(() => {
    mockRepository.current = new InMemoryShoppingChecksRepository();
  });

  it('starts with nothing ticked', async () => {
    const { result } = setup();

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.isChecked('milk')).toBe(false);
  });

  it('shows ticks that were stored before', async () => {
    await mockRepository.current.check({ key: 'milk', name: 'Milk' });

    const { result } = setup();

    await waitFor(() => expect(result.current.isChecked('Milk')).toBe(true));
  });

  it('matches names the way the key does, ignoring case and spacing', async () => {
    await mockRepository.current.check({ key: 'olive oil', name: 'olive oil' });

    const { result } = setup();

    await waitFor(() => expect(result.current.isChecked('  Olive   Oil ')).toBe(true));
  });

  it('ticks and unticks through the repository so they can sync', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => result.current.toggle('Milk'));
    expect(result.current.isChecked('Milk')).toBe(true);
    expect(await mockRepository.current.findAll()).toEqual([{ key: 'milk', name: 'Milk' }]);

    await act(async () => result.current.toggle('Milk'));
    expect(result.current.isChecked('Milk')).toBe(false);
    expect(await mockRepository.current.findAll()).toEqual([]);
  });

  it('picks up ticks made on another phone when the household revision moves', async () => {
    const view = setup(0);
    await waitFor(() => expect(view.result.current.loaded).toBe(true));

    await mockRepository.current.check({ key: 'eggs', name: 'Eggs' });
    expect(view.result.current.isChecked('Eggs')).toBe(false);
    await act(async () => view.bump(1));

    await waitFor(() => expect(view.result.current.isChecked('Eggs')).toBe(true));
  });

  it('drops a tick that was removed remotely', async () => {
    await mockRepository.current.check({ key: 'eggs', name: 'Eggs' });
    const view = setup(0);
    await waitFor(() => expect(view.result.current.isChecked('Eggs')).toBe(true));

    await mockRepository.current.uncheck('eggs');
    await act(async () => view.bump(1));

    await waitFor(() => expect(view.result.current.isChecked('Eggs')).toBe(false));
  });

  it('falls back to what is stored when a write fails', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    jest.spyOn(mockRepository.current, 'check').mockRejectedValueOnce(new Error('disk full'));

    await act(async () => result.current.toggle('Milk'));

    expect(result.current.isChecked('Milk')).toBe(false);
  });
});
