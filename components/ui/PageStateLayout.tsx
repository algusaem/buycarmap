import type { ReactNode } from "react";
import { TAB_BAR_CLEARANCE } from "@/components/nav/tab-bar-clearance";
import { cn } from "@/lib/utils";

interface PageStateLayoutProps {
  /**
   * The column's sides from `lg`, matched to the header above it: `session`,
   * the 48px of the access and landing headers, and the pages header's 32px
   * once the signed-in tab bar is on the page (the not-found page and the
   * root error); `pages`, the pages header's 32px always (/account's route
   * error).
   */
  sides: "session" | "pages";
  /** The state's body: an EmptyState or a PageError. */
  children: ReactNode;
}

// docs/specs/redesign-pages.md (PAGES-65, PAGES-68); F7-no-existe,
// F0-estado-error-pagina. The frame of the not-found page and of the root
// error: the state in a column 546px wide (830px from `xl`), as /favorites'
// list column, and from `lg` the empty map beside it, drawn for the eye only,
// with no region to name. The not-found page has no session of its own to read
// here; the tab bar (`with-tab-bar`, app/globals.css) shows exactly when the
// pages header does (components/nav/nav-routes.ts, PAGES-66).
export function PageStateLayout({ sides, children }: PageStateLayoutProps) {
  return (
    <main className="flex min-h-0 flex-1 bg-background">
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5.5 lg:w-136.5 lg:flex-none lg:px-12 lg:pt-7.5 lg:pb-7.5 xl:w-207.5",
          sides === "session" && "lg:with-tab-bar:px-8",
          sides === "pages" && "lg:px-8",
          TAB_BAR_CLEARANCE,
        )}
      >
        <div className="mt-4.5 lg:mt-14">{children}</div>
      </div>
      <div
        aria-hidden="true"
        className="hidden min-w-0 flex-1 border-l border-line-soft bg-map-ground lg:flex"
      />
    </main>
  );
}
