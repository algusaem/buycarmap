"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { err, ok, type Result } from "@/lib/result";
import { withRequestContext } from "@/lib/request-context";
import type { SearchInput } from "@/lib/search/schema";
import { alertIdSchema, asUserId } from "@/lib/ids";
import {
  ALERT_ERROR,
  type AlertError,
  type AlertErrorCode,
  alertCriteriaSchema,
  alertLabelSchema,
  type CreateAlertOutcome,
} from "./schema";
import { createAlertForUser, deleteAlertForUser } from "./service";

function alertError(code: AlertErrorCode): AlertError {
  return { code, messageKey: `alertErrors.${code}` };
}

export async function createAlert(
  criteria: SearchInput,
  label: string,
): Promise<Result<CreateAlertOutcome, AlertError>> {
  return withRequestContext(async () => {
    const user = await getCurrentUser();
    if (!user) return err(alertError(ALERT_ERROR.unauthenticated));

    // Before the seed poll, not after: a criteria set this broad must cost zero
    // upstream requests. Too broad is reported only when it is the sole
    // problem; anything else the schema refuses is invalid criteria.
    const parsed = alertCriteriaSchema.safeParse(criteria);
    if (!parsed.success) {
      const tooBroad = parsed.error.issues.every(
        (issue) => issue.message === ALERT_ERROR.criteriaTooBroad,
      );
      return err(alertError(tooBroad ? ALERT_ERROR.criteriaTooBroad : ALERT_ERROR.invalidCriteria));
    }

    const parsedLabel = alertLabelSchema.safeParse(label);
    if (!parsedLabel.success) {
      return err(alertError(ALERT_ERROR.invalidCriteria));
    }

    const saved = await createAlertForUser(asUserId(user.id), parsed.data, parsedLabel.data);
    if (!saved.ok) {
      return err(alertError(saved.error));
    }

    // MAPUI-43: `created` is false when the user already had this alert live.
    return ok(saved.value);
  });
}

export async function deleteAlert(alertId: string): Promise<Result<void, AlertError>> {
  return withRequestContext(async () => {
    const user = await getCurrentUser();
    if (!user) return err(alertError(ALERT_ERROR.unauthenticated));

    // A malformed id cannot belong to this (or any) user, so it is handled
    // the same way an id that simply does not exist is below: silently.
    const parsedId = alertIdSchema.safeParse(alertId);
    if (!parsedId.success) {
      return ok(undefined);
    }

    await deleteAlertForUser(asUserId(user.id), parsedId.data);
    return ok(undefined);
  });
}
