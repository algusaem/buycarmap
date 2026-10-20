import Link from "next/link";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  /** 20px in the desktop headers, 16px on the phone (Wordmark README). */
  size: "desktop" | "phone";
  className?: string;
}

// docs/design/system/components/Wordmark/README.md: type only, «BUYCAR» in
// text and «MAP» in lime, Unbounded 900, upper case, no letter-spacing, and
// always a link to the landing. The brand name is not translated; the
// upper case is CSS so the link's accessible name reads «BuyCarMap». Like the
// header links, it turns lime on hover and presses to 0.97 (MOTION-21).
// While «Saltar al contenido» has focus over it, it is not drawn but keeps
// its space (A11Y-1, SkipLink README).
export function Wordmark({ size, className }: WordmarkProps) {
  return (
    <Link
      href="/"
      className={cn(
        "font-display font-black uppercase leading-none text-text transition-[color,scale] hover:text-lime active:scale-97 motion-reduce:active:scale-none skip-link-focused:opacity-0",
        size === "desktop" ? "text-xl" : "text-base",
        className,
      )}
    >
      BuyCar<span className="text-lime">Map</span>
    </Link>
  );
}
