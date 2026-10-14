import { useCallback } from "react";
import { useMessages, useTranslations } from "next-intl";
import type { CarListing } from "@/interfaces/listing";
import { translateError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { useSignInGate } from "@/lib/hooks/useSignInGate";
import { removeFavorite, saveFavorite } from "@/server/favorites/actions";

/** What a heart press needs: the listing, the state it moves to, and where the saved state lives. */
export interface FavoriteToggle {
  listing: CarListing;
  next: boolean;
  /** Applies a saved state: the optimistic one first, the rolled-back one on failure. */
  apply: (saved: boolean) => void;
  /** The full current path and query, for the signed-out sign-in return (MAPUI-37). */
  callbackPath: string;
}

/**
 * The heart's behaviour (FAV-9 to FAV-12, FAV-18; docs/specs/redesign-map.md
 * MAPUI-36, MAPUI-37), shared by the car card, the map's results and its
 * preview card, so every heart on screen does the same thing. A failed save
 * resolves to the message to show; the caller toasts it, since a hook never
 * toasts (FRONT-15).
 */
export function useFavoriteToggle() {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const { requireSession } = useSignInGate();

  return useCallback(
    async ({ listing, next, apply, callbackPath }: FavoriteToggle): Promise<string | null> => {
      // Ignored until the session resolves (FAV-18, lib/hooks/useSignInGate.ts):
      // the click costs a sub-second window, a wrong redirect costs the page.
      // A signed-out visitor is sent to sign in and back to the very search
      // they were on, query included (MAPUI-37), rather than a disabled
      // control that would be a dead end.
      if (!requireSession(callbackPath)) return null;

      // Optimistic: favoriting is low-stakes and high-frequency, so the cost of
      // being briefly wrong is a heart that flickers back, while the cost of
      // waiting on a round trip is a control that feels broken.
      apply(next);

      try {
        const result = next ? await saveFavorite(listing) : await removeFavorite(listing.id);
        if (!result.ok) {
          apply(!next);
          return translateError(messages, result.error.messageKey);
        }
        return null;
      } catch {
        // An expected failure (invalid listing, signed out mid-request) reads
        // the domain-specific copy above. An unexpected one — a thrown database
        // or network error (PLAT-12, docs/specs/core-platform.md) — reads the
        // generic copy, since there is nothing more specific to say about it.
        apply(!next);
        return t("alertErrors.unexpected");
      }
    },
    [requireSession, messages, t],
  );
}
