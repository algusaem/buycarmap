import { z } from "zod";

// DATA-1/DATA-3 (docs/specs/core-data-model.md): a branded type per model, so
// an AlertId cannot be passed where a UserId is expected, and a Zod schema per
// model that parses an incoming id as that brand. Every function in
// server/*/service.ts and server/*/queries.ts that takes an entity id takes
// its branded type instead of a raw `string`, with the known exceptions
// docs/decisions/0015-data-model-conventions.md records.
//
// Every id in this app is a UUIDv7 since DATA-1 (`scripts/core-data-model.node.test.ts`
// enforces it on the schema), so every schema below parses with `z.uuid()`.
// Only the models whose id actually crosses a function boundary get one —
// see ADR 0015 for the ones that do not (an external listing id, never a
// branded model id, has its own `ListingRef` alias below instead).

// These two cross a client boundary (a form field, a URL segment) and are
// actually parsed with `.safeParse`/`.parse` elsewhere, so they stay exported.
export const userIdSchema = z.uuid().brand<"UserId">();
export const alertIdSchema = z.uuid().brand<"AlertId">();

// These three never arrive as client input — every AlertCriteriaId,
// AlertPollJobId and AccountId in this app is read back from Prisma or
// cast with the `as*Id` helpers below — so the schema itself is private,
// kept only to derive its branded type the same way the two above do.
const alertCriteriaIdSchema = z.uuid().brand<"AlertCriteriaId">();
const alertPollJobIdSchema = z.uuid().brand<"AlertPollJobId">();
const accountIdSchema = z.uuid().brand<"AccountId">();

// Derived from the schemas above (`z.infer`), not hand-rolled, so the type a
// function declares and the type `.parse`/`.safeParse` actually produces are
// never two unrelated brands that happen to share a name.
export type UserId = z.infer<typeof userIdSchema>;
export type AlertId = z.infer<typeof alertIdSchema>;
export type AlertCriteriaId = z.infer<typeof alertCriteriaIdSchema>;
export type AlertPollJobId = z.infer<typeof alertPollJobIdSchema>;
export type AccountId = z.infer<typeof accountIdSchema>;

// At a Prisma boundary (a row just read back, or an id this process minted
// itself with uuidv7()) the value is already a UUIDv7 by construction, so
// re-validating it with a schema above would be pure overhead. These helpers
// brand it directly — a type assertion, not a parse — which is safe exactly
// because the caller is a Prisma read/write and not client input. Client
// input is parsed with the schemas above instead.
export function asUserId(value: string): UserId {
  // Safe: only ever called on a User.id read from Prisma or minted by this process.
  return value as UserId;
}
// Unlike the four below, AlertId does also cross a client boundary elsewhere
// (server/alerts/actions.ts parses an incoming one with alertIdSchema). This
// cast exists only for server/alerts/queries.ts's getAlertWithMatches, whose
// raw URL segment findAlertWithMatches re-validates with alertIdSchema before
// it reaches Prisma — and for tests casting a factory-created Alert.id,
// already a real UUID.
export function asAlertId(value: string): AlertId {
  return value as AlertId;
}
export function asAlertCriteriaId(value: string): AlertCriteriaId {
  // Safe: only ever called on an AlertCriteria.id read from Prisma.
  return value as AlertCriteriaId;
}
export function asAlertPollJobId(value: string): AlertPollJobId {
  // Safe: only ever called on an AlertPollJob.id read from Prisma.
  return value as AlertPollJobId;
}
export function asAccountId(value: string): AccountId {
  // Safe: only ever called on an Account.id read from Prisma.
  return value as AccountId;
}

// Generates a UUIDv7: the 48-bit unix millisecond timestamp, the version
// nibble, Postgres-style variant bits, and cryptographically random bits for
// the rest — the same layout prisma/migrations/20261001000000_core_data_model's
// `uuid_generate_v7` SQL function produces, so an id minted here sorts
// alongside the ones Postgres' own `@default(uuid(7))` mints. Used where the
// service needs the id before the insert (server/alerts/service.ts, so a
// freshly created alert's `unsubscribeSubject` can be its own id without a
// second write).
export function uuidv7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const unixMs = Date.now();
  bytes[0] = (unixMs / 2 ** 40) & 0xff;
  bytes[1] = (unixMs / 2 ** 32) & 0xff;
  bytes[2] = (unixMs / 2 ** 24) & 0xff;
  bytes[3] = (unixMs / 2 ** 16) & 0xff;
  bytes[4] = (unixMs / 2 ** 8) & 0xff;
  bytes[5] = unixMs & 0xff;

  // Version 7, in the high nibble of byte 6.
  bytes[6] = 0x70 | (bytes[6] & 0x0f);
  // Variant 10, in the top two bits of byte 8.
  bytes[8] = 0x80 | (bytes[8] & 0x3f);

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Not a branded model id: the normalized, source-prefixed external listing
 * id (`wallapop-abc123`). Never a UUID, and never confused with a UUID —
 * see docs/decisions/0015-data-model-conventions.md. */
export type ListingRef = string;
