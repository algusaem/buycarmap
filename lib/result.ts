// PLAT-10 (docs/specs/core-platform.md): the shared discriminated union every
// converted Server Action returns instead of `{ success, error }`. Callers
// must narrow on `ok` before reading `value` or `error` — the type does not
// allow reading either field otherwise.

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** A feature's error code paired with the `t.*` path that renders it. */
export interface AppError<C extends string> {
  code: C;
  messageKey: string;
}

export function ok<T, E = never>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T = never, E = unknown>(error: E): Result<T, E> {
  return { ok: false, error };
}
