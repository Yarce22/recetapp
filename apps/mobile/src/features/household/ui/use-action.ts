import { useCallback, useState } from 'react';

import { useTranslation } from '@/shared/i18n/i18n-provider';

import { describeSharingError } from './describe-sharing-error';

/**
 * Runs one async sharing action at a time and keeps what the screen needs to
 * show about it: whether it is running and, if it failed, a translated sentence.
 *
 * `handle` lets a caller take over a failure it understands (for example "ask
 * what to do with local data") by returning true; anything else is described.
 */
export function useAction() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<void>, handle?: (cause: unknown) => boolean) => {
      setBusy(true);
      setError(null);
      try {
        await action();
      } catch (cause) {
        if (!handle?.(cause)) setError(describeSharingError(cause, t));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  return { busy, error, run };
}
