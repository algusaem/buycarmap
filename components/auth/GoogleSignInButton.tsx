"use client";

import { FcGoogle } from "react-icons/fc";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/hooks/useMounted";
import { useTranslation } from "@/lib/i18n/client";

interface GoogleSignInButtonProps {
  isPending: boolean;
  disabled: boolean;
  onClick: () => void;
}

// Google publishes mandatory branding rules for this button
// (developers.google.com/identity/branding-guidelines), and they override the
// app's own design tokens — this is the one place in the codebase where raw hex
// values are correct rather than a smell:
//
//   light  fill #FFFFFF, 1px stroke #747775, text #1F1F1F
//   dark   fill #131314, 1px stroke #8E918F, text #E3E3E3
//   padding 12px before the logo, 10px after it, 12px after the text
//
// The "G" itself may not be resized or recoloured, so `FcGoogle` (the standard
// full-colour mark) is used as-is.
//
// One deviation, stated plainly: the spec asks for Google Sans Medium. Pulling
// in an entire extra font for a single button is not worth the payload, so this
// inherits the app's font. Everything else follows the spec.
const PALETTE = {
  light: { fill: "#FFFFFF", stroke: "#747775", text: "#1F1F1F" },
  dark: { fill: "#131314", stroke: "#8E918F", text: "#E3E3E3" },
} as const;

export function GoogleSignInButton({
  isPending,
  disabled,
  onClick,
}: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  // Without this the server renders one palette and the client another,
  // producing a hydration mismatch — same guard ListingsMap uses.
  const mounted = useMounted();

  const colors =
    mounted && resolvedTheme === "light" ? PALETTE.light : PALETTE.dark;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        backgroundColor: colors.fill,
        border: `1px solid ${colors.stroke}`,
        color: colors.text,
      }}
      // Everything here that is not a colour is copied from `buttonVariants` so
      // this sits beside the GitHub button without looking foreign: same
      // cursor, same `transition-all`, same 3px ring, same disabled opacity.
      // `focus-visible:border-ring` is the one part deliberately left out — the
      // border is an inline style Google mandates, so a class could not win
      // against it anyway.
      className="group relative flex h-10 w-full cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-md px-3 text-sm font-medium transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
    >
      {/* The fill is fixed by the guidelines, so hover cannot recolour the
          background the way the app's other buttons do. This is Material's
          state layer instead — a currentColor wash at 8%/12% over the fill,
          which is what Google's own button does. It also leaves the "G"
          alone; the previous `hover:opacity-90` faded the mark itself, which
          is the one thing the guidelines forbid outright. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-current opacity-0 transition-opacity group-hover:opacity-[0.08] group-active:opacity-[0.12]"
      />
      {isPending ? (
        <AiOutlineLoading3Quarters className="relative h-[18px] w-[18px] shrink-0 animate-spin" />
      ) : (
        <FcGoogle className="relative h-[18px] w-[18px] shrink-0" />
      )}
      <span className="relative truncate">{t.auth.continueWithGoogle}</span>
    </button>
  );
}
