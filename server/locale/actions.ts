"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { isValidLocale, type Locale } from "@/lib/i18n/config";
import { ALERT_ERROR, type AlertErrorCode } from "@/server/alerts/schema";
import { saveUserLocale } from "./service";

interface LocaleResult {
  success: boolean;
  error?: AlertErrorCode;
}

export async function setLocale(locale: Locale): Promise<LocaleResult> {
  if (!isValidLocale(locale)) {
    return { success: false, error: ALERT_ERROR.invalidCriteria };
  }

  // A signed-out visitor is not an error: the cookie already carries their
  // preference, and there is no account to write it to.
  const user = await getCurrentUser();
  if (!user) return { success: true };

  try {
    await saveUserLocale(user.id, locale);
    return { success: true };
  } catch {
    return { success: false, error: ALERT_ERROR.unexpected };
  }
}
