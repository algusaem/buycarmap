"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * `aria-current="page"` rather than colour alone — a colour change says nothing
 * to a screen reader and fails the project's rule against colour-only status.
 * Returns undefined rather than "false" so the attribute is absent, which is
 * what NAV-7 asserts for every destination that is not the current one.
 */
export function currentPage(pathname: string, href: string) {
  return pathname === href ? ("page" as const) : undefined;
}

interface NavMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/**
 * The collapsed navigation for narrow viewports.
 *
 * Its contents are mounted only while it is open, which is load-bearing rather
 * than incidental: jsdom applies no CSS, so a navbar that emitted both a mobile
 * and a desktop tree would render every link twice and break every `getByRole`
 * query against it. See docs/specs/navbar.md, "Breakpoints stay in CSS".
 */
export function NavMenu({ open, onOpenChange, children }: NavMenuProps) {
  const t = useTranslations();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={t("nav.menu")}>
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={t("nav.closeMenu")}>
        {/* Radix requires a title for the dialog's accessible name; the panel
            is visually self-evident, so it is announced rather than shown. */}
        <SheetTitle className="sr-only">{t("nav.menu")}</SheetTitle>
        {/* A div, not a second <nav>: an unlabelled duplicate landmark is an
            axe violation, and the dialog already scopes these links. */}
        <div className="mt-10 flex flex-col gap-1">{children}</div>
        {/* The child selectors align these with the links above rather than
            leaving them centred: ThemeSwitcher renders a Button, which centres
            its content by default, and next to a column of left-aligned links
            that reads as a mistake. */}
        <div className="mt-auto flex flex-col gap-1 border-t border-border/50 pt-4 [&>button]:w-full [&>button]:justify-start [&>button]:px-3">
          {/* Both keep their labels here: a panel has the room a 56px bar does
              not, and this is the only surface where the language switcher is
              a plain inline control rather than a menu. */}
          <ThemeSwitcher />
          <div className="px-3">
            <LanguageSwitcher />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface NavMenuLinkProps {
  href: string;
  pathname: string;
  children: ReactNode;
}

export function NavMenuLink({ href, pathname, children }: NavMenuLinkProps) {
  return (
    <Link
      href={href}
      aria-current={currentPage(pathname, href)}
      className={cn(
        "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "hover:bg-accent hover:text-accent-foreground",
        "aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}
