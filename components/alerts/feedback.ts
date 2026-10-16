import { toast } from "sonner";
import type { CarListing } from "@/interfaces/listing";
import type { useAlertDelete } from "@/lib/hooks/useAlertDelete";
import type { useMatchFavorites } from "@/lib/hooks/useMatchFavorites";

// docs/specs/redesign-alerts.md (ALERTUI-19, ALERTUI-36): the alert pages'
// toasts. The hooks resolve a failure to its copy, since a hook never toasts
// (FRONT-15); /alerts and /alerts/[id] toast it through these, so a failed
// save and a failed delete read the same on both pages.

type ToggleSaved = ReturnType<typeof useMatchFavorites>["toggleSaved"];
type ConfirmDelete = ReturnType<typeof useAlertDelete>["confirm"];

/** Saves the match (`next` true) or removes it, and toasts the failure's copy when it fails. */
export async function toggleWithToast(
  toggleSaved: ToggleSaved,
  listing: CarListing,
  next: boolean,
): Promise<void> {
  const failure = await toggleSaved(listing, next);
  if (failure) toast.error(failure);
}

/**
 * «Eliminar» in the confirmation: runs the delete and toasts the failure's
 * copy when it fails. Resolves to the deleted alert's id, or null when
 * nothing was deleted (a press while one runs, or a failure).
 */
export async function confirmWithToast(confirm: ConfirmDelete): Promise<string | null> {
  const outcome = await confirm();
  if (!outcome) return null;
  if ("failure" in outcome) {
    toast.error(outcome.failure);
    return null;
  }
  return outcome.deleted;
}
