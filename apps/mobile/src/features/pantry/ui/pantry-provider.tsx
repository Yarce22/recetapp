import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useRefetchOnRemoteChange } from '@/features/household/ui/use-refetch-on-remote-change';
import { useTranslation } from '@/shared/i18n/i18n-provider';

import type { AddPantryItemInput } from '../application/add-pantry-item';
import { makeAddPantryItem } from '../application/add-pantry-item';
import { makeCookRecipe } from '../application/cook-recipe';
import type { CookRecipeInput, CookRecipeResult } from '../application/cook-recipe';
import { makeListPantry } from '../application/list-pantry';
import { makeRemovePantryItem } from '../application/remove-pantry-item';
import { makeUpdatePantryQuantity } from '../application/update-pantry-quantity';
import type { IngredientId } from '../domain/ingredient';
import { isLowStock } from '../domain/pantry-item';
import type { PantryEntry, PantryRepository } from '../domain/pantry-repository';
import type { Quantity } from '../domain/quantity';
import { createPantryRepository } from '../infrastructure/create-pantry-repository';

type PantryContextValue = {
  entries: PantryEntry[];
  lowStock: PantryEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (input: AddPantryItemInput) => Promise<void>;
  updateQuantity: (ingredientId: IngredientId, quantity: Quantity) => Promise<void>;
  removeItem: (ingredientId: IngredientId) => Promise<void>;
  cookRecipe: (input: CookRecipeInput) => Promise<CookRecipeResult>;
};

const PantryContext = createContext<PantryContextValue | null>(null);

/**
 * Wires the pantry use cases to a repository adapter and exposes them to the
 * screens.
 *
 * Which adapter that is gets decided by `createPantryRepository`, which has a
 * platform-specific web variant. Nothing here, and nothing in any screen,
 * knows whether the data lives in SQLite or somewhere else.
 */
export function PantryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<PantryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // A flag rather than text: the message is chosen at render, in whichever
  // language is active then.
  const [readFailed, setReadFailed] = useState(false);
  const { t } = useTranslation();

  const useCases = useMemo(() => {
    const repositoryPromise = createPantryRepository();

    // Each use case awaits the connection itself, so the provider can render
    // before the database has finished opening.
    const withRepository = <A, R>(make: (repo: PantryRepository) => (arg: A) => Promise<R>) => {
      return async (arg: A): Promise<R> => make(await repositoryPromise)(arg);
    };

    return {
      list: async () => makeListPantry(await repositoryPromise)(),
      add: withRepository<AddPantryItemInput, PantryEntry>(makeAddPantryItem),
      update: withRepository(makeUpdatePantryQuantity),
      remove: withRepository(makeRemovePantryItem),
      cook: withRepository<CookRecipeInput, CookRecipeResult>(makeCookRecipe),
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      // Both updates happen after the await. Clearing the error first would
      // run synchronously when the mount effect calls this, costing an extra
      // render before there is anything new to show.
      const next = await useCases.list();
      setEntries(next);
      setReadFailed(false);
    } catch {
      setReadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [useCases]);

  useEffect(() => {
    // The initial load runs inline rather than through refresh() so the state
    // updates are visibly behind an await, and so it can be cancelled: without
    // the guard, unmounting mid-read would set state on a gone component.
    let cancelled = false;

    void (async () => {
      try {
        const next = await useCases.list();
        if (!cancelled) {
          setEntries(next);
          setReadFailed(false);
        }
      } catch {
        if (!cancelled) setReadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [useCases]);

  // Household members edit the same table from other phones; show it when it lands.
  useRefetchOnRemoteChange(refresh);

  const value = useMemo<PantryContextValue>(
    () => ({
      entries,
      lowStock: entries.filter((entry) => isLowStock(entry.item)),
      loading,
      error: readFailed ? t('pantry.error.read') : null,
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
      cookRecipe: async (input) => {
        const result = await useCases.cook(input);
        await refresh();
        return result;
      },
    }),
    [entries, loading, readFailed, t, refresh, useCases],
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
