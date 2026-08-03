"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Heart, LogOut, User } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Button } from "./ui/button";
import { useTranslation } from "@/lib/i18n/client";

export function Navbar() {
  return (
    <nav className="w-full border-b border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link
          href="/"
          className="rounded-md text-lg font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          BuyCarMap
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <ThemeSwitcher />
          <LanguageSwitcher />
          <AuthNav />
        </div>
      </div>
    </nav>
  );
}

function AuthNav() {
  const { t } = useTranslation();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div
        className="h-8 w-16 animate-pulse rounded-md bg-muted"
        aria-hidden="true"
      />
    );
  }

  if (!session) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{t.nav.signIn}</Link>
        </Button>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/register">{t.nav.signUp}</Link>
        </Button>
      </div>
    );
  }

  // Mirrors the signed-out branch: same gaps, same Button primitives, so both
  // states line up. A bare <Link> styled by hand sat at a different height and
  // hovered differently from the buttons beside it.
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {/* Only for signed-in users: /favorites is guarded, so offering it to a
          visitor would be a link straight to a sign-in redirect. */}
      <Button asChild variant="ghost" size="sm" className="min-w-0">
        <Link href="/favorites">
          <Heart className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{t.nav.favorites}</span>
          <span className="sr-only sm:hidden">{t.nav.favorites}</span>
        </Link>
      </Button>
      {/* A real link, so Cmd/middle-click opens the account in a new tab. */}
      <Button asChild variant="ghost" size="sm" className="min-w-0">
        <Link href="/account" title={session.user.email}>
          <User className="h-4 w-4 shrink-0" />
          {/* The name can be long; it truncates rather than stretching the
              navbar. Hidden on mobile, where the icon carries the meaning. */}
          <span className="hidden max-w-[16ch] truncate sm:inline">
            {session.user.name || session.user.email}
          </span>
          <span className="sr-only sm:hidden">{t.nav.account}</span>
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{t.nav.signOut}</span>
        <span className="sr-only sm:hidden">{t.nav.signOut}</span>
      </Button>
    </div>
  );
}
