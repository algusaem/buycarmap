import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/test/msw/server";
import { renderWithI18n } from "@/test/utils/render";
import { makeFavoriteInput } from "@/test/fixtures/favorites";
import { FavoritesList } from "./FavoritesList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/favorites",
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user-ada" } },
    status: "authenticated",
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/server/favorites/actions", () => ({
  saveFavorite: vi.fn(),
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

const saved = [
  makeFavoriteInput({ id: "wallapop-abc123", title: "Audi A3 2.0 TDI" }),
  makeFavoriteInput({
    id: "cochesnet-99",
    title: "Seat Leon FR",
    source: "Coches.net",
    price: 11200,
  }),
];

describe("FavoritesList", () => {
  it("FAV-13: renders every saved listing from stored data alone", async () => {
    const sourceCalls = countSourceCalls();

    renderWithI18n(<FavoritesList favorites={saved} />);

    expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    expect(screen.getByText("Seat Leon FR")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    // The whole reason favorites are snapshotted (spec › Decisions and
    // rationale): the page must render with every source API unreachable.
    expect(sourceCalls).toEqual([]);
  });

  it("FAV-13: shows the snapshotted price, not a re-fetched one", () => {
    renderWithI18n(<FavoritesList favorites={saved} />);

    expect(screen.getByText(/11\.200/)).toBeInTheDocument();
  });

  it("FAV-13: links each saved listing back to its source", () => {
    renderWithI18n(<FavoritesList favorites={[saved[0]]} />);

    const [link] = screen.getAllByRole("link");
    expect(link).toHaveAttribute("href", saved[0].url);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("FAV-14: offers a way back to searching when nothing is saved", () => {
    renderWithI18n(<FavoritesList favorites={[]} />);

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    // No dead ends: the empty state has to lead somewhere.
    expect(screen.getByRole("link")).toHaveAttribute("href", "/map");
  });

  it("FAV-14: has no accessibility violations when empty", async () => {
    const { container } = renderWithI18n(<FavoritesList favorites={[]} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
