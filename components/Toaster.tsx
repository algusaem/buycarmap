"use client";

import type { CSSProperties } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Toaster as SonnerToaster } from "sonner";

// Sonner sizes its list and every toast in it from `--width`: the toast's
// 380px at most, and 16px clear of each side on a narrower screen.
const TOASTER_STYLE = { "--width": "var(--toast-width)" } satisfies CSSProperties;

// Toast/README.md: an 18px icon with a 2.4 stroke, `check-circle` in lime when
// it went well and `alert-circle` in danger when it failed, in place of
// Sonner's filled white icons.
const SUCCESS_ICON = (
  <CircleCheck aria-hidden="true" strokeWidth={2.4} className="size-4.5 text-lime" />
);
const ERROR_ICON = (
  <CircleAlert aria-hidden="true" strokeWidth={2.4} className="size-4.5 text-danger" />
);

/**
 * Sonner's toaster in the app's single dark theme (FRONT-23, LOOK-14 —
 * docs/specs/redesign-foundation.md).
 *
 * Sonner injects its styles unlayered, so they beat Tailwind 4's
 * `@layer utilities` whatever the specificity: without the important modifier
 * the token classes never apply and every toast renders Sonner's own palette.
 * `theme="dark"` keeps Sonner's secondary styles (description, close button)
 * on the same theme. The close button is always shown and takes its
 * accessible name from the messages, «Cerrar aviso» (SAVED-36), since
 * Sonner's default is English.
 *
 * Where it sits (SAVED-24, docs/specs/redesign-saved.md; Toast/README.md):
 * 12px under the header, or under `/map`'s header band at desktop width, and
 * centred over the list column on the pages that have one beside a map, on
 * the viewport elsewhere. The page names itself with `data-toast-anchor`, and
 * app/globals.css turns that into `--toast-top` and `--toast-centre`, so this
 * stays one global Toaster.
 */
export function Toaster() {
  const t = useTranslations();

  return (
    <SonnerToaster
      position="top-center"
      theme="dark"
      closeButton
      offset={{ top: "var(--toast-top)" }}
      mobileOffset={{ top: "var(--toast-top)" }}
      style={TOASTER_STYLE}
      className="lg:left-toast-centre!"
      icons={{ success: SUCCESS_ICON, error: ERROR_ICON }}
      toastOptions={{
        closeButtonAriaLabel: t("common.closeToast"),
        // The row the Toast README draws: 14/14/14/18 padding and a 12px gap,
        // the 18px icon flush (Sonner nudges it with negative margins), the
        // title at 15px semibold, and the action a ghost pill in lime at 14px
        // bold, 8/12 padding. The action and the close button keep their drawn
        // size and get the Button primitive's 44px hit area (RULES.md §19,
        // components/ui/button.tsx): a 44px pseudo-element centred over them.
        // Sonner's unlayered `[data-button] { outline: 0 }` would also hide the
        // action's keyboard focus, so it gets LOOK-11's ring back, important:
        // a 2px lime outline offset by 3px, as app/globals.css draws it.
        classNames: {
          toast:
            "gap-3! bg-surface! py-3.5! pr-3.5! pl-4.5! border-line! text-text! rounded-card! shadow-float!",
          icon: "m-0! size-4.5! [&>svg]:m-0!",
          title: "text-body-15! font-semibold!",
          actionButton:
            "m-0! h-auto! justify-center! rounded-pill! bg-transparent! px-3! py-2! text-meta! font-bold! text-lime! before:absolute before:size-11 focus-visible:outline-2! focus-visible:outline-solid! focus-visible:outline-lime! focus-visible:outline-offset-3!",
          // Sonner pins the close button over the toast's top-left corner; the
          // design puts it inside, last in the row after the action: 32px,
          // borderless, a 16px x in text-muted (Toast/README.md).
          closeButton:
            "static! order-last! size-8! shrink-0 transform-none! border-0! bg-transparent! text-text-muted! hover:bg-transparent! hover:text-text! [&>svg]:size-4! before:absolute before:size-11",
        },
      }}
    />
  );
}
