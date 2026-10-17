// docs/specs/redesign-navigation.md (HEAD): which header each route takes and
// which section it belongs to. The worked-example table in the spec is the
// whole contract; these functions are its only reading.

/** The kind of header a route draws (spec › Decisions: one per kind of page). */
export type HeaderKind = "map" | "pages" | "landing" | "access" | "legal" | "notFound";

/** The three sections of the pages header and the bottom nav. */
export type Section = "map" | "saved" | "alerts";

const LEGAL_ROUTES = new Set(["/privacy", "/terms"]);

/**
 * The sign-in, sign-up and recovery pages, and the development pages
 * `/palette` and `/typography`, which have no drawn header of their own.
 */
const ACCESS_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/confirm-email",
  "/palette",
  "/typography",
]);

function isAlertsRoute(pathname: string) {
  return pathname === "/alerts" || pathname.startsWith("/alerts/");
}

/** The signed-in section pages: `/favorites`, `/alerts`, `/alerts/[id]` and `/account`. */
function isSectionPage(pathname: string) {
  return pathname === "/favorites" || pathname === "/account" || isAlertsRoute(pathname);
}

/**
 * A known route takes its own header, and an error page the header of the
 * route that failed. An address no route matches is the not-found page, whose
 * header follows the session, not the path: the access header signed out, the
 * pages header with nothing current signed in (docs/specs/redesign-pages.md,
 * PAGES-66; amends HEAD-6 to HEAD-8). `/alerts/[id]`'s 404 is not one: its
 * path is Alertas', which stays current.
 */
export function headerKind(pathname: string): HeaderKind {
  if (pathname === "/map") return "map";
  if (pathname === "/") return "landing";
  if (isSectionPage(pathname)) return "pages";
  if (LEGAL_ROUTES.has(pathname)) return "legal";
  if (ACCESS_ROUTES.has(pathname)) return "access";
  return "notFound";
}

/** The section marked current (HEAD-4): none on `/account`, where the avatar is. */
export function currentSection(pathname: string): Section | undefined {
  if (pathname === "/favorites") return "saved";
  if (isAlertsRoute(pathname)) return "alerts";
  return undefined;
}

/**
 * Where the phone header's «Volver» leads, before the wordmark: an alert's
 * page goes back to Alertas (docs/specs/redesign-alerts.md, ALERTUI-22;
 * amends HEAD-7). Every other section page has no «Volver».
 */
export function backHref(pathname: string): string | undefined {
  return pathname.startsWith("/alerts/") ? "/alerts" : undefined;
}

/** Mapa · Guardados · Alertas, in the order both the pages header and the bottom nav draw them. */
export const SECTIONS: readonly { section: Section; href: string; labelKey: string }[] = [
  { section: "map", href: "/map", labelKey: "nav.map" },
  { section: "saved", href: "/favorites", labelKey: "nav.saved" },
  { section: "alerts", href: "/alerts", labelKey: "nav.alerts" },
];

/** The phone tab bar's tabs (MAPUI-52): the three sections plus «Cuenta». */
export type Tab = Section | "account";

/**
 * The tab marked current (MAPUI-52). Unlike `currentSection`, the map is a
 * tab of its own and `/account` marks «Cuenta», because on a phone the tab
 * bar, not the header, says where you are.
 */
export function currentTab(pathname: string): Tab | undefined {
  if (pathname === "/map") return "map";
  if (pathname === "/account") return "account";
  return currentSection(pathname);
}

/**
 * Where the tab bar shows: the map, for everyone, and the signed-in section
 * pages and landing (docs/specs/redesign-entry.md, ENTRY-8, amending
 * MAPUI-52: the landing was the one signed-in page without it), and the
 * signed-in not-found page, with no tab current (PAGES-66).
 */
export function showsTabBar(pathname: string, signedIn: boolean) {
  if (pathname === "/map") return true;
  if (!signedIn) return false;
  return isSectionPage(pathname) || pathname === "/" || headerKind(pathname) === "notFound";
}
