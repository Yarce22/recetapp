import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { pantryEntry } from '@/features/household/testing/device';
import { SharingTestProvider, sharingValue } from '@/features/household/testing/fake-sharing';

import { InMemoryPantryRepository } from '../../infrastructure/in-memory-pantry-repository';
import { PantryProvider, usePantry } from '../pantry-provider';

const mockRepository = { current: new InMemoryPantryRepository() };
jest.mock('../../infrastructure/create-pantry-repository', () => ({
  createPantryRepository: jest.fn(async () => mockRepository.current),
}));

function Names() {
  const { entries, loading } = usePantry();
  return (
    <Text>{loading ? 'loading' : entries.map((e) => e.ingredient.displayName).join(',')}</Text>
  );
}

function tree(revision: number) {
  return (
    <SharingTestProvider value={sharingValue({ sync: { remoteRevision: revision } })}>
      <PantryProvider>
        <Names />
      </PantryProvider>
    </SharingTestProvider>
  );
}

describe('PantryProvider and the household', () => {
  beforeEach(() => {
    mockRepository.current = new InMemoryPantryRepository();
  });

  it('shows the local pantry as before', async () => {
    await mockRepository.current.save(pantryEntry('Milk'));

    render(tree(0));

    expect(await screen.findByText('Milk')).toBeTruthy();
  });

  it('reloads when household changes land in the local tables', async () => {
    const view = render(tree(0));
    await waitFor(() => expect(screen.queryByText('loading')).toBeNull());

    // What the sync engine does: write underneath the screen, then bump the revision.
    await mockRepository.current.save(pantryEntry('Eggs'));
    expect(screen.queryByText('Eggs')).toBeNull();
    await act(async () => view.rerender(tree(1)));

    expect(await screen.findByText('Eggs')).toBeTruthy();
  });

  it('does not reload while the revision stays the same', async () => {
    const view = render(tree(2));
    await waitFor(() => expect(screen.queryByText('loading')).toBeNull());

    await mockRepository.current.save(pantryEntry('Eggs'));
    await act(async () => view.rerender(tree(2)));

    expect(screen.queryByText('Eggs')).toBeNull();
  });
});
