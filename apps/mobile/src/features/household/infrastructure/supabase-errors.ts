import { SharingError } from '../domain/household';

type ErrorLike = {
  name?: string;
  message?: string;
  code?: string;
  status?: number;
};

const NETWORK_MESSAGE = /network|fetch|timed? ?out|offline|connection|failed to connect/i;

/**
 * Translates whatever supabase-js reports into the small set of failures the
 * sync engine reasons about. This is the only place that knows Postgres and
 * PostgREST error codes.
 */
export function toSharingError(error: unknown): SharingError {
  if (error instanceof SharingError) return error;

  const e = (typeof error === 'object' && error !== null ? error : {}) as ErrorLike;
  const message = e.message ?? 'Unknown sharing error.';
  const code = e.code ?? '';
  const status = e.status ?? 0;

  if (e.name === 'AuthRetryableFetchError') return new SharingError('offline', message);

  // Row Level Security and explicit refusals from the RPCs.
  if (code === '42501' || status === 403) return new SharingError('forbidden', message);

  // Expired or missing token.
  if (
    code === 'PGRST301' ||
    code === 'PGRST303' ||
    code === '28000' ||
    status === 401 ||
    /JWT/.test(message)
  ) {
    return new SharingError('auth', message);
  }

  // Constraint, type and range violations and the RPCs' own refusals (P0001):
  // this request will never be accepted as it is.
  if (
    /^(22|23)/.test(code) ||
    code === 'P0001' ||
    code === 'PGRST102' ||
    status === 400 ||
    status === 422
  ) {
    return new SharingError('rejected', message);
  }

  if (status >= 500 || /^(53|57|58)/.test(code)) return new SharingError('server', message);

  if (NETWORK_MESSAGE.test(message)) return new SharingError('offline', message);

  return new SharingError('server', message);
}
