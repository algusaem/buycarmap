import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SECTIONS, type Section } from "./nav-routes";

// The pieces every header in docs/design/system/components/HeaderNav/README.md
// shares. Each header draws two regions: the desktop one from `lg` and the
// phone one below it. Which one shows is CSS alone, so both are always in the
// DOM (spec › Decisions: one header per kind of page, chosen by route).

/** What the header knows about the session (HEAD-11, HEAD-12). */
export type HeaderSession =
  | { status: "pending" }
  | { status: "signedOut" }
  | { status: "signedIn"; name: string | null | undefined; email: string };

interface RegionProps {
  /** The landing and sign-in pages: no divider (and 48px sides on desktop). */
  open: boolean;
  children: ReactNode;
}

/** Desktop: 80px tall, 32px sides and a line-soft divider; open pages 48px and no divider. */
export function DesktopRegion({ open, children }: RegionProps) {
  return (
    <div
      data-testid="header-desktop"
      className={cn(
        "hidden h-20 items-center justify-between lg:flex",
        open ? "px-12" : "border-b border-line-soft px-8",
      )}
    >
      {children}
    </div>
  );
}

/** Phone: 64px tall, 20px sides; a line-soft divider on the section pages only. */
export function PhoneRegion({ open, children }: RegionProps) {
  return (
    <div
      data-testid="header-phone"
      className={cn(
        "flex h-16 items-center justify-between px-5 lg:hidden",
        !open && "border-b border-line-soft",
      )}
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
        "whitespace-nowrap rounded-pill px-4 py-2.5 text-[15px] font-bold transition-colors",
        current ? "bg-text text-bg" : "text-text hover:text-lime",
      )}
    >
      {children}
    </Link>
  );
}

/** Phone link on the right of the sign-in and landing headers: 14px weight 700 in a 44px hit area. */
export function PhoneTextLink({ href, children }: Omit<TextLinkProps, "current">) {
  return (
    <Link
      href={href}
      className="flex h-11 min-w-11 items-center justify-center whitespace-nowrap text-sm font-bold text-text transition-colors hover:text-lime"
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
