"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { searchSchema, type SearchInput } from "@/lib/search/schema";
import { ALERT_ERROR, type AlertErrorCode } from "./schema";
import { createAlertForUser, deleteAlertForUser, isSpecificEnough } from "./service";

interface AlertResult {
  success: boolean;
  error?: AlertErrorCode;
}

export async function createAlert(criteria: SearchInput, label: string): Promise<AlertResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: ALERT_ERROR.unauthenticated };

  const parsed = searchSchema.safeParse(criteria);
  if (!parsed.success) {
    return { success: false, error: ALERT_ERROR.invalidCriteria };
  }

  // Before the seed poll, not after: a criteria set this broad must cost zero
  // upstream requests.
  if (!isSpecificEnough(parsed.data)) {
    return { success: false, error: ALERT_ERROR.criteriaTooBroad };
  }

  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    return { success: false, error: ALERT_ERROR.invalidCriteria };
  }

  try {
    const createError = await createAlertForUser(user.id, parsed.data, trimmedLabel);
    if (createError) {
      return { success: false, error: createError };
    }

    return { success: true };
  } catch {
    return { success: false, error: ALERT_ERROR.unexpected };
  }
}

export async function deleteAlert(alertId: string): Promise<AlertResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: ALERT_ERROR.unauthenticated };

  try {
    await deleteAlertForUser(user.id, alertId);
    return { success: true };
  } catch {
    return { success: false, error: ALERT_ERROR.unexpected };
  }
}
