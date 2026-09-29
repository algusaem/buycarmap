import { z } from "zod";

// Codes, not sentences — same reasoning as AUTH_ERROR in server/auth/schema.ts: a server
// action cannot read the client's i18n context, and the default locale is
// Spanish. The UI resolves these into copy at render time.
export const FAVORITE_ERROR = {
  unauthenticated: "unauthenticated",
  invalidListing: "invalidListing",
  unexpected: "unexpected",
} as const;

export type FavoriteErrorCode = (typeof FAVORITE_ERROR)[keyof typeof FAVORITE_ERROR];

// Exactly the values lib/*/normalize.ts writes into `CarListing.source`.
// Anything else did not come from this app's own normalizers, so it is not a
// listing we can render back.
const FAVORITE_SOURCES = ["Wallapop", "Coches.net", "Milanuncios"] as const;

// The fields that must survive the round trip for the favorites page to render
// a card without asking any source API. Numeric fields allow zero because
// `CarListing` uses zero for "unknown" (see lib/wallapop/normalize.ts), and the
// free-text fields allow empty strings for the same reason.
export const favoriteListingSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  source: z.enum(FAVORITE_SOURCES),
  subtitle: z.string(),
  image: z.string(),
  brand: z.string(),
  model: z.string(),
  location: z.string(),
  fuel: z.string(),
  url: z.string(),
  price: z.number().nonnegative(),
  mileage: z.number().nonnegative(),
  year: z.number().nonnegative(),
  lat: z.number(),
  lng: z.number(),
});
