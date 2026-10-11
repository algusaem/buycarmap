"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { COOKIE_NAME, type Locale } from "@/lib/i18n/config";
import { setLocale as storeAccountLocale } from "@/server/locale/actions";

// ALERT-50 (docs/specs/alerts.md): the stored locale is what alert emails are
// written in, so the switch also hands the choice to `setLocale`. It is called
// signed in or not, because the action is a no-op for a signed-out caller
// (ALERT-33). Its outcome never blocks or reverts the switch: the cookie is
// already written and the page refreshes regardless, a rejection is only
// reported, and an error result needs nothing from the user. Server Actions
// run serially, so the last switch is the last write and no version guard is
// needed.
async function persistLocale(locale: Locale) {
  try {
    await storeAccountLocale(locale);
  } catch (error) {
    Sentry.captureException(error);
  }
}

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
      persistLocale(locale);
      startTransition(() => {
        router.refresh();
      });
    },
    [router],
  );

  return { setLocale, isPending };
}
