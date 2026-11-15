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

// docs/specs/map-description-search.md (DESC-32): `urlQueryParams: false`
// above stops the SDK collecting query strings as their own structured data,
// but a URL (the page's own, a navigation breadcrumb's `from`/`to`, a
// fetch/xhr breadcrumb's `url`, a server event's `contexts.nextjs.request_path`,
// an exception's stack-frame `filename`/`abs_path`) can still carry the typed
// description text as a `q=` value wherever Sentry records the URL itself as
// one string, and a `console` breadcrumb logged from a failed RSC fetch
// carries it inside its `message`. `withoutQuery` strips a URL's query and
// fragment; `beforeSend` and `beforeBreadcrumb` apply that everywhere every
// `Sentry.init` in this app (the browser, the server and edge) can reach.

/** The URL with its query string and fragment removed; the input unchanged if neither is present. */
export function withoutQuery(url: string): string {
  // No `/s` (dotAll) flag: the `target` in tsconfig.json is ES2017, which
  // TS refuses that flag under (TS1501) — moot anyway, since a URL carries
  // no newline for `.` to need to cross.
  return url.replace(/[?#].*$/, "");
}

export interface SentryRequestEvent {
  request?: { url?: string };
  // `Record<string, unknown>`, not a named `request_path?: string`: the
  // SDK's own `Contexts` type (@sentry/core) declares `[key: string]:
  // Context | undefined` with `Context = Record<string, unknown>`, so a
  // narrower field here is a type the SDK's richer event can never satisfy —
  // `request_path` is read and narrowed with `typeof` below instead
  // (RULES.md §7: `unknown` at a boundary, narrowed right away). The index
  // signature on `contexts` itself keeps TS from flagging this as a "weak
  // type" with nothing in common with the SDK's `Contexts` (which has no
  // `nextjs` property of its own, only the index signature).
  contexts?: { nextjs?: Record<string, unknown>; [key: string]: unknown };
  exception?: {
    values?: { stacktrace?: { frames?: { filename?: string; abs_path?: string }[] } }[];
  };
}

/**
 * Strips the query string from the event's own request URL, the Next.js
 * request path, and every exception stack frame's `filename`/`abs_path`
 * (DESC-32) — the browser SDK's `GlobalHandlers` integration fills a stack
 * frame's `filename` with the page's own URL, query included.
 */
export function beforeSend<T extends SentryRequestEvent>(event: T): T {
  if (event.request?.url) {
    event.request.url = withoutQuery(event.request.url);
  }
  const requestPath = event.contexts?.nextjs?.request_path;
  if (event.contexts?.nextjs && typeof requestPath === "string") {
    event.contexts.nextjs.request_path = withoutQuery(requestPath);
  }
  for (const value of event.exception?.values ?? []) {
    for (const frame of value.stacktrace?.frames ?? []) {
      if (frame.filename) frame.filename = withoutQuery(frame.filename);
      if (frame.abs_path) frame.abs_path = withoutQuery(frame.abs_path);
    }
  }
  return event;
}

export interface SentryBreadcrumb {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * Strips the query string from a navigation breadcrumb's `from`/`to`, a
 * fetch/xhr breadcrumb's `url`, and a URL-looking token inside a `console`
 * breadcrumb's `message` (the failed-RSC-fetch log, which also carries the
 * logged arguments in `data.arguments` — dropped outright, since one of them
 * is the error itself) (DESC-32) — the breadcrumb categories the SDK itself
 * names these fields under.
 */
export function beforeBreadcrumb<T extends SentryBreadcrumb>(breadcrumb: T): T {
  const { data, category } = breadcrumb;
  if (category === "console") {
    if (typeof breadcrumb.message === "string") {
      // The query runs to the next whitespace, so a dot inside it goes too —
      // only the sentence's own closing mark, right before whitespace or the
      // string's end, stays.
      breadcrumb.message = breadcrumb.message.replace(/[?#]\S*?(?=[.,;:)'"]?(?:\s|$))/g, "");
    }
    if (data) delete data.arguments;
    return breadcrumb;
  }
  if (!data) return breadcrumb;
  if (category === "navigation") {
    if (typeof data.from === "string") data.from = withoutQuery(data.from);
    if (typeof data.to === "string") data.to = withoutQuery(data.to);
  } else if (category === "fetch" || category === "xhr") {
    if (typeof data.url === "string") data.url = withoutQuery(data.url);
  }
  return breadcrumb;
}
