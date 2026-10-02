"use client";

import { useEffect } from "react";

const COOKIE_NAME = "tz";
const MAX_AGE = 60 * 60 * 24 * 365;

// FRONT-9 (docs/specs/core-frontend.md): `i18n/request.ts` reads this cookie
// for the time zone `lib/format.ts`'s date formatters use, falling back to
// UTC until it lands — which is why it is never a literal in a component.
// Mounted once in the root layout; writes once per browser, same as the
// locale cookie (`lib/hooks/useLocaleSwitcher.ts`).
export function TimeZoneCookie() {
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // biome-ignore lint/suspicious/noDocumentCookie: no request is in flight to attach a Set-Cookie header to — the browser's time zone is only knowable client-side, so it is written directly, the same way the locale cookie is (lib/hooks/useLocaleSwitcher.ts).
    document.cookie = `${COOKIE_NAME}=${timeZone};path=/;max-age=${MAX_AGE}`;
  }, []);

  return null;
}
