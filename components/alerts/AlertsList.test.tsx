import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { makeAlertSummary } from "@/test/fixtures/alerts";
import { AlertsList } from "./AlertsList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/alerts",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/server/alerts/actions", () => ({
  deleteAlert: vi.fn(async () => ({ success: true })),
}));

const ALERTS = [
  makeAlertSummary({
    id: "alert-1",
    label: "Audi A3 under 20k",
    matchCount: 3,
    criteria: { brand: "Audi", model: "A3", maxPrice: 20000 },
  }),
  makeAlertSummary({
    id: "alert-2",
    label: "Any BMW near Valencia",
    matchCount: 0,
    criteria: { brand: "BMW", latitude: 39.47, longitude: -0.376 },
  }),
];

describe("AlertsList", () => {
  it("ALERT-28: lists every alert the user has saved", () => {
    renderWithI18n(<AlertsList alerts={ALERTS} />);

    expect(screen.getByText("Audi A3 under 20k")).toBeInTheDocument();
    expect(screen.getByText("Any BMW near Valencia")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("ALERT-28: summarises the criteria so an alert is identifiable without opening it", () => {
    renderWithI18n(<AlertsList alerts={[ALERTS[0]]} />);

    const [card] = screen.getAllByRole("article");
    // A saved SearchInput is unreadable as JSON; the point of the summary is
    // that someone can tell their alerts apart.
    expect(card).toHaveTextContent(/Audi/);
    expect(card).toHaveTextContent(/A3/);
    expect(card).toHaveTextContent(/20[.,]000/);
  });

  it("ALERT-28: shows how many matches each alert has found", () => {
    renderWithI18n(<AlertsList alerts={ALERTS} />);

    const [audi, bmw] = screen.getAllByRole("article");
    expect(audi).toHaveTextContent("3");
    expect(bmw).toHaveTextContent("0");
  });

  it("ALERT-28: links each alert to its matches rather than leaving the count dead", () => {
    renderWithI18n(<AlertsList alerts={[ALERTS[0]]} />);

    expect(screen.getByRole("link", { name: /Audi A3 under 20k/i })).toHaveAttribute(
      "href",
      "/alerts/alert-1",
    );
  });

  it("ALERT-28: marks an unsubscribed alert as inactive rather than hiding it", () => {
    renderWithI18n(
      <AlertsList alerts={[makeAlertSummary({ label: "Paused hunt", active: false })]} />,
    );

    const [card] = screen.getAllByRole("article");
    // Silently hiding it would leave the user wondering where their alert went.
    expect(card).toHaveTextContent(/paused|inactive/i);
  });

  it("ALERT-29: offers a way to create one when nothing is saved", () => {
    renderWithI18n(<AlertsList alerts={[]} />);

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    // No dead ends: the empty state has to lead somewhere.
    expect(screen.getByRole("link")).toHaveAttribute("href", "/map");
  });

  it("ALERT-29: has no accessibility violations when empty", async () => {
    const { container } = renderWithI18n(<AlertsList alerts={[]} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
