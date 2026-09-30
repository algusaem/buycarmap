// Mirrors @sentry/core's own `HttpBodyCollectionTarget` union structurally,
// so `httpBodies` below can be given an explicit, empty, mutable array —
// `as const` on the object literal would otherwise freeze `[]` into a
// `readonly []`, which the SDK's `DataCollection.httpBodies?:
// HttpBodyCollectionTarget[]` (a mutable array) rejects.
type HttpBodyCollectionTarget =
  | "incomingRequest"
  | "outgoingRequest"
  | "incomingResponse"
  | "outgoingResponse";

// The installed @sentry/nextjs 11.x SDK replaced the old `sendDefaultPii`
// boolean with a `dataCollection` object; this is that option turned all the
// way off, extended beyond `userInfo` to cookies, headers, request bodies,
// query strings, database query data and stack-frame variables, since the
// SDK's own defaults collect all of those too.
export const PRIVATE_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [] as HttpBodyCollectionTarget[],
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
  queues: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
} as const;
