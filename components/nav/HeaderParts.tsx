import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SECTIONS, type Section } from "./nav-routes";

// The pieces every header in docs/design/system/components/HeaderNav/README.md
// shares. Each header draws two regions: the desktop one from `lg` and the
// phone one below it. Which one shows is CSS alone, so both are always in the
// DOM (spec › Decisions: one header per kind of page, chosen by route).

/**
 * «Volver», the 40px round link of an alert's page (docs/specs/redesign-alerts.md,
 * ALERTUI-20, ALERTUI-22; HeaderNav/README.md): in the phone header before the
 * wordmark, and on desktop beside the page's name. 40px drawn, with the 44px
 * hit area of RULES.md §19.
 */
export function BackLink({ href }: { href: string }) {
  const t = useTranslations();

  return (
    <Link
      href={href}
      aria-label={t("nav.back")}
      className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-text transition-colors before:absolute before:size-11 hover:text-lime"
    >
      <ChevronLeft aria-hidden="true" strokeWidth={2.2} className="size-4.5" />
    </Link>
  );
}

/** What the header knows about the session (HEAD-11, HEAD-12). */
export type HeaderSession =
  | { status: "pending" }
  | { status: "signedOut" }
  | { status: "signedIn"; name: string | null | undefined; email: string };

interface RegionProps {
  /** The landing and sign-in pages: the page background (and 48px sides on desktop). */
  open: boolean;
  children: ReactNode;
}

/** Desktop: 80px tall, 32px sides on the `surface` background (HEAD-20); open pages 48px on the page background. */
export function DesktopRegion({ open, children }: RegionProps) {
  return (
    <div
      data-testid="header-desktop"
      className={cn(
        "hidden h-20 items-center justify-between lg:flex",
        open ? "px-12" : "bg-surface px-8",
      )}
    >
      {children}
    </div>
  );
}

/** Phone: 64px tall, 20px sides; the `surface` background on the section pages only (HEAD-20). */
export function PhoneRegion({ open, children }: RegionProps) {
  return (
    <div
      data-testid="header-phone"
      className={cn("flex h-16 items-center justify-between px-5 lg:hidden", !open && "bg-surface")}
    >
      {children}
    </div>
  );
}

interface MainNavProps {
  className?: string;
  children: ReactNode;
}

/** The header's navigation landmark, named «Principal» (`nav.main`). */
export function MainNav({ className, children }: MainNavProps) {
  const t = useTranslations();

  return (
    <nav aria-label={t("nav.main")} className={cn("flex items-center", className)}>
      {children}
    </nav>
  );
}

interface TextLinkProps {
  href: string;
  current?: boolean;
  children: ReactNode;
}

/**
 * Desktop link: 15px weight 700, padding 10px 16px, lime on hover; the current
 * section is inverted (text fill, bg text) and `aria-current="page"` (HEAD-4).
 */
export function TextLink({ href, current = false, children }: TextLinkProps) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "whitespace-nowrap rounded-pill px-4 py-2.5 text-body-15 font-bold transition-colors",
        current ? "bg-text text-bg" : "text-text hover:text-lime",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Phone link on the right of the sign-in and landing headers: 14px weight 700,
 * drawn at its text's own width (so «Mapa» sits where the board puts it) with
 * a 44px hit area around it, the way components/ui/button.tsx does it.
 */
export function PhoneTextLink({ href, children }: Omit<TextLinkProps, "current">) {
  return (
    <Link
      href={href}
      className="flex h-11 items-center justify-center whitespace-nowrap text-sm font-bold text-text transition-colors before:absolute before:size-11 hover:text-lime"
    >
      {children}
    </Link>
  );
}

/** Mapa · Guardados · Alertas, with the current one marked (HEAD-3, HEAD-4). */
export function SectionLinks({ current }: { current: Section | undefined }) {
  const t = useTranslations();

  return SECTIONS.map(({ section, href, labelKey }) => (
    <TextLink key={section} href={href} current={section === current}>
      {t(labelKey)}
    </TextLink>
  ));
}
