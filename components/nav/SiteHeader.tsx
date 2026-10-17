"use client";

import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { AccessHeader } from "./AccessHeader";
import type { HeaderSession } from "./HeaderParts";
import { LandingHeader } from "./LandingHeader";
import { MapHeader } from "./MapHeader";
import { backHref, currentSection, headerKind } from "./nav-routes";
import { PagesHeader } from "./PagesHeader";

// docs/specs/redesign-navigation.md (HEAD): picks the header by route and
// session, exactly as the spec's worked-example table does. The session comes
// from `authClient.useSession()`, so a session that ends on screen re-renders
// the signed-out header without a reload (HEAD-12). The not-found page is the
// one route whose header the session alone picks (PAGES-66).
interface SessionUser {
  name?: string | null;
  email: string;
}

function toHeaderSession(user: SessionUser | undefined, isPending: boolean): HeaderSession {
  if (isPending) return { status: "pending" };
  if (!user) return { status: "signedOut" };
  return { status: "signedIn", name: user.name, email: user.email };
}

export function SiteHeader() {
  const pathname = usePathname();
  const { data, isPending } = authClient.useSession();

  const session = toHeaderSession(data?.user, isPending);
  const kind = headerKind(pathname);

  return (
    <header className="shrink-0">
      {kind === "map" && <MapHeader session={session} />}
      {kind === "pages" && (
        <PagesHeader
          session={session}
          current={currentSection(pathname)}
          onAccount={pathname === "/account"}
          open={false}
          back={backHref(pathname)}
        />
      )}
      {kind === "landing" && session.status === "signedIn" && (
        <PagesHeader session={session} current={undefined} onAccount={false} open />
      )}
      {kind === "landing" && session.status !== "signedIn" && (
        <LandingHeader pending={session.status === "pending"} />
      )}
      {kind === "notFound" && session.status === "signedIn" && (
        <PagesHeader session={session} current={undefined} onAccount={false} open={false} />
      )}
      {/* While the session resolves, the not-found page offers neither
          header: the landing's pending boxes stand in (PAGES-66, HEAD-11). */}
      {kind === "notFound" && session.status === "pending" && <LandingHeader pending />}
      {(kind === "access" ||
        kind === "legal" ||
        (kind === "notFound" && session.status === "signedOut")) && (
        <AccessHeader legal={kind === "legal"} />
      )}
    </header>
  );
}
