import { z } from "zod";

// FRONT-2 (docs/specs/core-frontend.md): validates the cursors a client hands
// back on every round after the first, alongside the existing
// lib/search/schema.ts validation of the search filters themselves.
export const searchCursorsSchema = z.object({
  wallapop: z.string().nullable(),
  // MAP-24 (docs/specs/map-and-search.md › A repeated Wallapop cursor ends
  // Wallapop): every Wallapop cursor requested in earlier rounds of this
  // search, so a round can tell a repeat from a new page. Defaults to [] so
  // a client built before this change, still open during a deploy, keeps
  // validating — it only lacks the protection until it reloads. No bound
  // (open question 7): it is already bounded by how many pages Wallapop
  // serves for one search, and the length of a real next_page cursor is
  // unmeasured.
  wallapopRequested: z.array(z.string()).default([]),
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
  wallapopRequested: [],
  cochesNet: 0,
  milanuncios: 0,
};
