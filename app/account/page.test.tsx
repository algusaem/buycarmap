import { beforeEach, describe, expect, it, vi } from "vitest";
import { ES_COPY } from "@/test/utils/copy";

// `next-intl/server`'s real implementation only resolves under the
// "react-server" module condition Next.js sets at build time — absent here,
// stubbed with `ES_COPY.t` (test/utils/copy.ts), as app/privacy/page.test.tsx does.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));

const { getAccountOverview } = vi.hoisted(() => ({ getAccountOverview: vi.fn() }));
vi.mock("@/server/account/queries", () => ({ getAccountOverview }));
// The page's own work is the props it hands the client page; the client page
// is AccountPage.test.tsx's.
vi.mock("@/components/account/AccountPage", () => ({ AccountPage: () => null }));

import { AccountPage } from "@/components/account/AccountPage";
import * as pageModule from "./page";

const OVERVIEW = {
  name: "Alba",
  email: "alba@example.com",
  emailConfirmed: true,
  hasPassword: true,
  twoFactorEnabled: false,
  version: 1,
  createdAt: new Date("2026-03-10T10:00:00.000Z"),
  providers: [],
  favoritesCount: 8,
  alertsCount: 3,
  sessions: [
    {
      id: "s1",
      userAgent: "Safari/604 iPhone",
      lastUsedAt: new Date("2026-10-16T12:00:00.000Z"),
      current: false,
    },
    {
      id: "s2",
      userAgent: "Chrome/120 Windows",
      lastUsedAt: new Date("2026-10-14T12:00:00.000Z"),
      current: true,
    },
  ],
};

/** The `sessions` prop the route rendered AccountPage with. */
async function renderedSessions() {
  const element = await pageModule.default();
  // The route's `main` holds the one AccountPage element.
  const page = element.props.children;
  expect(page.type).toBe(AccountPage);
  return page.props.sessions as { id: string; current: boolean }[];
}

beforeEach(() => {
  getAccountOverview.mockResolvedValue(OVERVIEW);
});

// docs/specs/redesign-pages.md (PAGES-69, worked example "Browser titles").
describe("PAGES-69: /account's browser title", () => {
  it("PAGES-69: is exactly Cuenta · Buy Car Map", async () => {
    const metadata = await pageModule.generateMetadata();

    expect(metadata.title).toBe("Cuenta · Buy Car Map");
  });
});

// docs/specs/redesign-pages.md (PAGES-35, PAGES-49): the session behind this
// request comes marked from the page query (server/account/queries.ts), and
// the route hands the sessions on as they are, for «esta» and «Este
// dispositivo».
describe("PAGES-35: the current session as the page query marked it", () => {
  it("PAGES-35: the session the query marked current reads current, the other does not", async () => {
    const sessions = await renderedSessions();

    expect(sessions.map(({ id, current }) => [id, current])).toEqual([
      ["s1", false],
      ["s2", true],
    ]);
    expect(getAccountOverview).toHaveBeenCalledTimes(1);
  });
});
