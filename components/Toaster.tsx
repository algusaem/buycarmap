"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";
import { useMounted } from "@/lib/hooks/useMounted";

/**
 * Sonner's toaster, themed from next-themes (FRONT-23, docs/specs/core-frontend.md).
 *
 * Sonner injects its styles unlayered, so they beat Tailwind 4's
 * `@layer utilities` whatever the specificity: without the important modifier
 * the token classes never apply and every toast renders Sonner's light
 * palette. The theme prop keeps Sonner's secondary styles (close button,
 * description) on the same theme. Before mount it falls back to dark, the
 * app's default, so the server render matches.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  return (
    <SonnerToaster
      position="top-center"
      theme={mounted && resolvedTheme === "light" ? "light" : "dark"}
      toastOptions={{
        classNames: {
          toast: "bg-card! border-border! text-foreground!",
        },
      }}
    />
  );
}
