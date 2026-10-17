"use client";

import { FcGoogle } from "react-icons/fc";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface GoogleSignInButtonProps {
  isPending: boolean;
  disabled: boolean;
  onClick: () => void;
  /** /login only: the "G" shows from 1440px wide (ENTRY-25), not from 1024px. */
  markFromDesktop?: boolean;
}

// docs/design/system/components/GoogleButton/README.md. Google publishes
// mandatory branding rules for this button
// (developers.google.com/identity/branding-guidelines), and the app has one
// dark theme, so the button always takes Google's dark variant. Its values
// live in the `google-*` tokens in app/globals.css, and
// GoogleSignInButton.test.tsx checks them against Google's literals.
//
// The "G" itself may not be resized or recoloured, so `FcGoogle` (the standard
// full-colour mark) is used as-is, on the white `google-badge`.
//
// Two deviations, stated plainly: the guidelines ask for Google Sans Medium.
// Pulling in an entire extra font for a single button is not worth the
// payload, so this inherits the app's font. The phone board also drops the
// "G" mark entirely rather than shrinking it (ENTRY-19) — the guidelines
// forbid resizing or recolouring it, not leaving it out, but there is no
// permitted size between the desktop mark and nothing.
export function GoogleSignInButton({
  isPending,
  disabled,
  onClick,
  markFromDesktop = false,
}: GoogleSignInButtonProps) {
  const t = useTranslations();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group relative flex h-13 w-full cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-pill border border-google-line bg-google-bg px-6 font-sans text-body-15 font-semibold text-google-text disabled:pointer-events-none disabled:opacity-50"
    >
      {/* The fill is fixed by the guidelines, so hover cannot recolour the
          background the way the app's other buttons do. This is Material's
          state layer instead — a currentColor wash at 8%/12% over the fill,
          which is what Google's own button does. It also leaves the "G"
          alone: fading the mark itself is the one thing the guidelines
          forbid outright. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-current opacity-0 transition-opacity group-hover:opacity-[0.08] group-active:opacity-[0.12]"
      />
      {isPending ? (
        <AiOutlineLoading3Quarters
          aria-hidden="true"
          className="relative h-5 w-5 shrink-0 animate-spin"
        />
      ) : (
        // The "G" shows at desktop width; the phone board leaves it out.
        <span
          aria-hidden="true"
          className={cn(
            "relative hidden h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-google-badge",
            markFromDesktop ? "3xl:flex" : "lg:flex",
          )}
        >
          <FcGoogle className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="relative truncate">{t("auth.continueWithGoogle")}</span>
    </button>
  );
}
