"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { isValidLocale, type Locale } from "@/lib/i18n/config";
import { type AppError, err, ok, type Result } from "@/lib/result";
import { withRequestContext } from "@/lib/request-context";
import { asUserId } from "@/lib/ids";
import { LOCALE_ERROR, type LocaleErrorCode } from "./schema";
import { saveUserLocale } from "./service";

type LocaleError = AppError<LocaleErrorCode>;

export async function setLocale(locale: Locale): Promise<Result<void, LocaleError>> {
  return withRequestContext(async () => {
    if (!isValidLocale(locale)) {
      return err({
        code: LOCALE_ERROR.invalidLocale,
        messageKey: `localeErrors.${LOCALE_ERROR.invalidLocale}`,
      });
    }

    // A signed-out visitor is not an error: the cookie already carries their
    // preference, and there is no account to write it to.
    const user = await getCurrentUser();
    if (!user) return ok(undefined);

    await saveUserLocale(asUserId(user.id), locale);
    return ok(undefined);
  });
}
