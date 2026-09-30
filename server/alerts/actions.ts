"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { type AppError, err, ok, type Result } from "@/lib/result";
import { withRequestContext } from "@/lib/request-context";
import { searchSchema, type SearchInput } from "@/lib/search/schema";
import { ALERT_ERROR, type AlertErrorCode } from "./schema";
import { createAlertForUser, deleteAlertForUser, isSpecificEnough } from "./service";

type AlertError = AppError<AlertErrorCode>;

function alertError(code: AlertErrorCode): AlertError {
  return { code, messageKey: `alertErrors.${code}` };
}

export async function createAlert(
  criteria: SearchInput,
  label: string,
): Promise<Result<void, AlertError>> {
  return withRequestContext(async () => {
    const user = await getCurrentUser();
    if (!user) return err(alertError(ALERT_ERROR.unauthenticated));

    const parsed = searchSchema.safeParse(criteria);
    if (!parsed.success) {
      return err(alertError(ALERT_ERROR.invalidCriteria));
    }

    // Before the seed poll, not after: a criteria set this broad must cost zero
    // upstream requests.
    if (!isSpecificEnough(parsed.data)) {
      return err(alertError(ALERT_ERROR.criteriaTooBroad));
    }

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return err(alertError(ALERT_ERROR.invalidCriteria));
    }

    const createError = await createAlertForUser(user.id, parsed.data, trimmedLabel);
    if (createError) {
      return err(alertError(createError));
    }

    return ok(undefined);
  });
}

export async function deleteAlert(alertId: string): Promise<Result<void, AlertError>> {
  return withRequestContext(async () => {
    const user = await getCurrentUser();
    if (!user) return err(alertError(ALERT_ERROR.unauthenticated));

    await deleteAlertForUser(user.id, alertId);
    return ok(undefined);
  });
}
