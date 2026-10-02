import { z } from "zod";

// FRONT-2 (docs/specs/core-frontend.md): validates the cursors a client hands
// back on every round after the first, alongside the existing
// lib/search/schema.ts validation of the search filters themselves.
export const searchCursorsSchema = z.object({
  wallapop: z.string().nullable(),
  cochesNet: z.number().int().nonnegative(),
  milanuncios: z.number().int().nonnegative(),
});

export type SearchCursors = z.infer<typeof searchCursorsSchema>;

// Defined here (not server/search/service.ts) so lib/hooks/useListingsSearch.ts
// can import it without crossing dependency-cruiser's `hooks-only-actions-or-
// schema` boundary (LAYOUT-6) — a hook may import a feature's `actions.ts` or
// `schema.ts`, nothing else, and `service.ts` is "nothing else". `actions.ts`
// itself cannot export this: a `"use server"` file may only export async
// functions.
export const EMPTY_SEARCH_CURSORS: SearchCursors = {
  wallapop: null,
  cochesNet: 0,
  milanuncios: 0,
};
