"use client";

import { useTranslations } from "next-intl";
import { Toaster as SonnerToaster } from "sonner";

/**
 * Sonner's toaster in the app's single dark theme (FRONT-23, LOOK-14 —
 * docs/specs/redesign-foundation.md).
 *
 * Sonner injects its styles unlayered, so they beat Tailwind 4's
 * `@layer utilities` whatever the specificity: without the important modifier
 * the token classes never apply and every toast renders Sonner's own palette.
 * `theme="dark"` keeps Sonner's secondary styles (description, close button)
 * on the same theme. The close button is always shown and takes its
 * accessible name from the messages, since Sonner's default is English.
 */
export function Toaster() {
  const t = useTranslations();

  return (
    <SonnerToaster
      position="top-center"
      theme="dark"
      closeButton
      toastOptions={{
        closeButtonAriaLabel: t("common.close"),
        classNames: {
          toast: "bg-surface! border-line! text-text! rounded-card! shadow-float!",
          actionButton: "bg-transparent! text-lime!",
          closeButton: "bg-surface! border-line! text-text!",
        },
      }}
    />
  );
}
