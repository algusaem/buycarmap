"use client";

import { LanguageSwitcher } from "./LanguageSwitcher";

export function Navbar() {
  return (
    <nav className="w-full border-b border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="font-bold text-lg tracking-tight">BuyCarMap</div>
        <LanguageSwitcher />
      </div>
    </nav>
  );
}
