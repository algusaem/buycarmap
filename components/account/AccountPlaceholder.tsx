import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { cardClasses } from "./AccountCard";
import { AccountHeading } from "./AccountHeading";

// docs/specs/redesign-pages.md (PAGES-56; amends FRONT-14);
// F7-cuenta-eliminar-y-mas › Cargando. /account while it loads: «Cuenta», its
// line and «Cerrar sesión» already in place, then eight cards shaped like
// AccountCard in `surface-strong` bars (the card is `surface`) — the first
// with the avatar's circle, the others with a title, a badge, two lines and a
// button, the last across two columns from `lg`. One `aria-busy` region whose
// placeholders are each aria-hidden, with a visually hidden «Cargando…» in a
// polite status. «Cerrar sesión» waits disabled until the page it signs out
// of has loaded. CSS breakpoints pick the composition, so nothing waits on
// the client's media queries.

/** The seven cards after the own one, each with its title bar's width as the board draws it. */
const CARDS = [
  { key: "email", titleWidth: "w-20" },
  { key: "password", titleWidth: "w-28" },
  { key: "two-factor", titleWidth: "w-24" },
  { key: "google", titleWidth: "w-20" },
  { key: "sessions", titleWidth: "w-24" },
  { key: "data", titleWidth: "w-24" },
  { key: "delete", titleWidth: "w-36" },
];

export function AccountPlaceholder() {
  const t = useTranslations();

  return (
    <AccountHeading
      signOut={<SignOutPlaceholder size="pad-14" className="hidden lg:inline-flex" />}
    >
      <div aria-busy="true" className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-5">
        <span role="status" className="sr-only">
          {t("account.loading")}
        </span>
        <div aria-hidden="true" className={cardClasses()}>
          <div className="flex items-center gap-3.5">
            <Skeleton className="size-12 shrink-0 rounded-pill bg-surface-strong lg:size-14" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-24 rounded-skeleton-sm bg-surface-strong" />
              <Skeleton className="h-3.5 w-36 rounded-skeleton-sm bg-surface-strong" />
            </div>
          </div>
          <Skeleton className="h-3.5 w-4/5 rounded-skeleton-sm bg-surface-strong" />
          <Skeleton className="mt-auto h-11 w-36 rounded-pill bg-surface-strong" />
        </div>
        {CARDS.map((card, index) => (
          <div
            key={card.key}
            aria-hidden="true"
            className={cardClasses(undefined, index === CARDS.length - 1)}
          >
            <div className="flex min-h-6.5 items-center justify-between gap-3">
              <Skeleton
                className={cn("h-4 rounded-skeleton-sm bg-surface-strong", card.titleWidth)}
              />
              <Skeleton className="h-6.5 w-20 rounded-pill bg-surface-strong" />
            </div>
            <Skeleton className="h-3.5 w-11/12 rounded-skeleton-sm bg-surface-strong" />
            <Skeleton className="h-3.5 w-3/5 rounded-skeleton-sm bg-surface-strong" />
            <Skeleton className="mt-auto h-11 w-36 rounded-pill bg-surface-strong" />
          </div>
        ))}
      </div>

      <SignOutPlaceholder className="mt-3 w-full lg:hidden" />
    </AccountHeading>
  );
}

interface SignOutPlaceholderProps {
  /** As SignOutButton's: the board's smaller secondary on the heading's row. */
  size?: "44" | "pad-14";
  className: string;
}

/** «Cerrar sesión» in its place (AccountCard README), disabled while the page loads. */
function SignOutPlaceholder({ size = "44", className }: SignOutPlaceholderProps) {
  const t = useTranslations();

  return (
    <Button type="button" variant="secondary" size={size} disabled className={className}>
      {t("nav.signOut")}
    </Button>
  );
}
