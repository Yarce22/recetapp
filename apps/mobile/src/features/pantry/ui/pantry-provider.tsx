import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getDatabase } from '@/shared/db/client';

import type { AddPantryItemInput } from '../application/add-pantry-item';
import { makeAddPantryItem } from '../application/add-pantry-item';
import { makeListPantry } from '../application/list-pantry';
import { makeRemovePantryItem } from '../application/remove-pantry-item';
import { makeUpdatePantryQuantity } from '../application/update-pantry-quantity';
import type { IngredientId } from '../domain/ingredient';
import { isLowStock } from '../domain/pantry-item';
import type { PantryEntry } from '../domain/pantry-repository';
import type { Quantity } from '../domain/quantity';
import { SqlitePantryRepository } from '../infrastructure/sqlite-pantry-repository';

type PantryContextValue = {
  entries: PantryEntry[];
  lowStock: PantryEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (input: AddPantryItemInput) => Promise<void>;
  updateQuantity: (ingredientId: IngredientId, quantity: Quantity) => Promise<void>;
  removeItem: (ingredientId: IngredientId) => Promise<void>;
};

const PantryContext = createContext<PantryContextValue | null>(null);

/**
 * Wires the pantry use cases to the SQLite adapter and exposes them to the
 * screens.
 *
 * This is the only place that knows which adapter is in use. Swapping SQLite
 * for a synced backend is a change to the two lines below, not to any screen.
 */
export function PantryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<PantryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const useCases = useMemo(() => {
    const repositoryPromise = getDatabase().then((db) => new SqlitePantryRepository(db));

    // Each use case awaits the connection itself, so the provider can render
    // before the database has finished opening.
    const withRepository = <A, R>(
      make: (repo: SqlitePantryRepository) => (arg: A) => Promise<R>,
    ) => {
      return async (arg: A): Promise<R> => make(await repositoryPromise)(arg);
    };

    return {
      list: async () => makeListPantry(await repositoryPromise)(),
      add: withRepository<AddPantryItemInput, PantryEntry>(makeAddPantryItem),
      update: withRepository(makeUpdatePantryQuantity),
      remove: withRepository(makeRemovePantryItem),
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setEntries(await useCases.list());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read the pantry.');
    } finally {
      setLoading(false);
    }
  }, [useCases]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<PantryContextValue>(
    () => ({
      entries,
      lowStock: entries.filter((entry) => isLowStock(entry.item)),
      loading,
      error,
      refresh,
      addItem: async (input) => {
        await useCases.add(input);
        await refresh();
      },
      updateQuantity: async (ingredientId, quantity) => {
        await useCases.update({ ingredientId, quantity });
        await refresh();
      },
      removeItem: async (ingredientId) => {
        await useCases.remove({ ingredientId });
        await refresh();
      },
    }),
    [entries, loading, error, refresh, useCases],
  );

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}

export function usePantry(): PantryContextValue {
  const value = useContext(PantryContext);
  if (!value) {
    throw new Error('usePantry must be used inside a PantryProvider.');
  }
  return value;
}
