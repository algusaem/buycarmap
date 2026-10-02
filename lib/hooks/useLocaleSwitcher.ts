"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COOKIE_NAME, type Locale } from "@/lib/i18n/config";

// FRONT-9 (docs/specs/core-frontend.md): next-intl resolves the locale from
// this cookie (`i18n/request.ts`) but has no client API of its own for
// changing it, so the app keeps writing it directly, exactly as the removed
// `I18nProvider.setLocale` did, and refreshes so the next request's
// `getRequestConfig` picks it up.
export function useLocaleSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setLocale = useCallback(
    (locale: Locale) => {
      // biome-ignore lint/suspicious/noDocumentCookie: carried over from the hand-rolled i18n layer (ADR 0016) — next-intl has no client-side "set the active locale" API, so the cookie it reads is still written directly here.
      document.cookie = `${COOKIE_NAME}=${locale};path=/;max-age=31536000`;
      startTransition(() => {
        router.refresh();
      });
    },
    [router],
  );

  return { setLocale, isPending };
}
