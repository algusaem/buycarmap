"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { BellRing, Heart, LogOut, User } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NavMenu, NavMenuLink, currentPage } from "./NavMenu";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n/client";
import { LOCALES, Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

// Language names are conventionally written in their own language rather than
// translated, so these are literals and not i18n keys.
const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  // Navigation is client-side, so the panel stays mounted straight through a
  // link click and would sit on top of the page it just opened. Rather than an
  // effect that closes it — which is state syncing state, and what the
  // `set-state-in-effect` rule exists to stop — the open state remembers which
  // route it was opened on. A different route means it is closed, derived
  // rather than corrected after the fact.
  const [menu, setMenu] = useState({ open: false, at: pathname });
  const menuOpen = menu.open && menu.at === pathname;
  const setMenuOpen = (open: boolean) => setMenu({ open, at: pathname });

  const isLoading = status === "loading";

  return (
    <nav className="w-full border-b border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex h-11 items-center rounded-md px-1 text-lg font-bold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          BuyCarMap
        </Link>

        {/* The whole right-hand cluster is rendered while the session is still
            resolving, just invisible and removed from the accessibility tree.
            A skeleton of a different shape is what made the bar reflow on every
            load, and `aria-hidden` is what keeps NAV-8 honest: role queries and
            screen readers both skip it, so nothing is offered before it is
            real. `invisible` is visibility:hidden, which also takes the
            controls out of the tab order — without that, `aria-hidden` over
            focusable elements would be an axe violation in its own right.
            It reserves the signed-out width: the first-visit case, and the only
            one that can be guessed before the session says otherwise. */}
        <div
          aria-hidden={isLoading}
          className={cn("flex items-center", isLoading && "invisible")}
        >
          {isLoading ? (
            <SignedOutControls
              menuOpen={false}
              onMenuOpenChange={() => {}}
              pathname={pathname}
            />
          ) : session ? (
            <SignedInControls
              name={session.user.name || session.user.email}
              email={session.user.email}
              menuOpen={menuOpen}
              onMenuOpenChange={setMenuOpen}
              pathname={pathname}
            />
          ) : (
            <SignedOutControls
              menuOpen={menuOpen}
              onMenuOpenChange={setMenuOpen}
              pathname={pathname}
            />
          )}
        </div>
      </div>
    </nav>
  );
}

interface ControlsProps {
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  pathname: string;
}

interface SignedInControlsProps extends ControlsProps {
  name: string;
  email: string;
}

function SignedOutControls({
  menuOpen,
  onMenuOpenChange,
  pathname,
}: ControlsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="hidden items-center gap-4 lg:flex">
        <ThemeSwitcher showLabel={false} />
        <LanguageSwitcher />
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{t.nav.signIn}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/register">{t.nav.signUp}</Link>
        </Button>
      </div>

      {/* Visible at every width: registration was `hidden sm:inline-flex`, so
          the product's primary action did not exist on a phone. Two taps behind
          a menu would still hide that it is possible at all. */}
      <div className="flex items-center gap-2 lg:hidden">
        <Button asChild size="sm" className="h-11">
          <Link href="/register">{t.nav.signUp}</Link>
        </Button>
        <NavMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
          <NavMenuLink href="/login" pathname={pathname}>
            {t.nav.signIn}
          </NavMenuLink>
          <NavMenuLink href="/register" pathname={pathname}>
            {t.nav.signUp}
          </NavMenuLink>
        </NavMenu>
      </div>
    </>
  );
}

function SignedInControls({
  name,
  email,
  menuOpen,
  onMenuOpenChange,
  pathname,
}: SignedInControlsProps) {
  const { t, locale, setLocale } = useTranslation();

  return (
    <>
      <div className="hidden items-center gap-2 lg:flex">
        <ThemeSwitcher showLabel={false} />

        {/* Kept in the bar rather than folded into the dropdown: these are the
            destinations a signed-in user came for, and burying a frequent one
            to tidy a row trades against them to buy nothing. */}
        <Button asChild variant="ghost" size="sm">
          <Link
            href="/favorites"
            aria-current={currentPage(pathname, "/favorites")}
          >
            <Heart className="h-4 w-4 shrink-0" />
            {t.nav.favorites}
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/alerts" aria-current={currentPage(pathname, "/alerts")}>
            <BellRing className="h-4 w-4 shrink-0" />
            {t.alerts.title}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="min-w-0" title={email}>
              <User className="h-4 w-4 shrink-0" />
              <span className="max-w-[16ch] truncate">{name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem asChild>
              <Link href="/account">
                <User />
                {t.nav.account}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Radio items rather than the inline LanguageSwitcher: nesting
                that control in a menu item makes it unreachable by keyboard,
                because arrow keys land on the item and Enter fires the item's
                own onSelect. Language is set once and then forgotten, which is
                what earns it a place in here rather than in the bar. */}
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(next) => setLocale(next as Locale)}
            >
              {LOCALES.map((loc) => (
                <DropdownMenuRadioItem key={loc} value={loc}>
                  {LOCALE_LABELS[loc]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            {/* The one control here with a consequence, which is why it is
                behind a deliberate open rather than beside the account link it
                used to sit next to at 32px tall. */}
            <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>
              <LogOut />
              {t.nav.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center lg:hidden">
        <NavMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
          <NavMenuLink href="/favorites" pathname={pathname}>
            <Heart className="h-4 w-4 shrink-0" />
            {t.nav.favorites}
          </NavMenuLink>
          <NavMenuLink href="/alerts" pathname={pathname}>
            <BellRing className="h-4 w-4 shrink-0" />
            {t.alerts.title}
          </NavMenuLink>
          <NavMenuLink href="/account" pathname={pathname}>
            <User className="h-4 w-4 shrink-0" />
            {t.nav.account}
          </NavMenuLink>
          <Button
            variant="ghost"
            className="h-11 justify-start gap-3 px-3"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {t.nav.signOut}
          </Button>
        </NavMenu>
      </div>
    </>
  );
}
