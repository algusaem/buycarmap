import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/test/msw/server";
import { renderWithI18n } from "@/test/utils/render";
import { makeMatchListing } from "@/test/fixtures/alerts";
import { AlertMatchesList } from "./AlertMatchesList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/alerts/alert-1",
}));
// The matches are rendered with CarListingCard, which reads the session to
// decide what its favorite control does.
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user-ada" } },
    status: "authenticated",
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/actions/favorites", () => ({
  saveFavorite: vi.fn(async () => ({ success: true })),
  removeFavorite: vi.fn(async () => ({ success: true })),
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));

/** Fails the test if any source API is touched while the page renders. */
function countSourceCalls() {
  const calls: string[] = [];
  server.use(
    http.get("*/api/wallapop/search", ({ request }) => {
      calls.push(request.url);
      return HttpResponse.json({});
    }),
    http.post("*/api/cochesnet/search", ({ request }) => {
      calls.push(request.url);
      return HttpResponse.json({});
    }),
    http.get("*/api/milanuncios/search", ({ request }) => {
      calls.push(request.url);
      return HttpResponse.json({});
    }),
  );
  return calls;
}

// Deliberately supplied oldest-first, so "newest first" has to be the
// component's doing rather than the order it happened to receive.
const MATCHES = [
  {
    ...makeMatchListing({ id: "wallapop-old", title: "Audi A3 Sportback" }),
    foundAt: new Date("2026-08-01T09:00:00.000Z"),
  },
  {
    ...makeMatchListing({
      id: "cochesnet-mid",
      title: "Seat Leon FR",
      source: "Coches.net",
      price: 11200,
    }),
    foundAt: new Date("2026-08-02T09:00:00.000Z"),
  },
  {
    ...makeMatchListing({ id: "wallapop-new", title: "Audi A3 Cabrio" }),
    foundAt: new Date("2026-08-03T09:00:00.000Z"),
  },
];

describe("AlertMatchesList", () => {
  it("ALERT-39: renders every match the alert has found", () => {
    const sourceCalls = countSourceCalls();

    renderWithI18n(<AlertMatchesList alertLabel="Audi A3 under 20k" matches={MATCHES} />);

    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("Audi A3 Cabrio")).toBeInTheDocument();
    expect(screen.getByText("Seat Leon FR")).toBeInTheDocument();
    // Snapshots again: this page has to render with every source unreachable.
    expect(sourceCalls).toEqual([]);
  });

  it("ALERT-39: orders matches newest first", () => {
    renderWithI18n(<AlertMatchesList alertLabel="Audi A3 under 20k" matches={MATCHES} />);

    const titles = screen.getAllByRole("article").map((card) => card.textContent);
    expect(titles[0]).toContain("Audi A3 Cabrio");
    expect(titles[1]).toContain("Seat Leon FR");
    expect(titles[2]).toContain("Audi A3 Sportback");
  });

  it("ALERT-39: shows the price the match was found at", () => {
    renderWithI18n(<AlertMatchesList alertLabel="Audi A3 under 20k" matches={[MATCHES[1]]} />);

    expect(screen.getByText(/11[.,]200/)).toBeInTheDocument();
  });

  it("ALERT-39: links each match back to its source listing", () => {
    renderWithI18n(<AlertMatchesList alertLabel="Audi A3 under 20k" matches={[MATCHES[0]]} />);

    const link = screen
      .getAllByRole("link")
      .find((node) => node.getAttribute("href") === MATCHES[0].url);
    expect(link).toBeDefined();
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("ALERT-40: an alert that has found nothing says it is watching", () => {
    renderWithI18n(<AlertMatchesList alertLabel="Audi A3 under 20k" matches={[]} />);

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    // "Nothing yet" and "broken" look identical without this — the empty state
    // has to say which one it is.
    expect(screen.getByRole("status")).toHaveTextContent(/watching|no matches/i);
  });

  it("ALERT-40: names the alert so an empty page is still identifiable", () => {
    renderWithI18n(<AlertMatchesList alertLabel="Audi A3 under 20k" matches={[]} />);

    expect(screen.getByText("Audi A3 under 20k")).toBeInTheDocument();
  });

  it("ALERT-40: has no accessibility violations when empty", async () => {
    const { container } = renderWithI18n(
      <AlertMatchesList alertLabel="Audi A3 under 20k" matches={[]} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
