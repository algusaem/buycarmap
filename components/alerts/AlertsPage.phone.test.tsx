import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import type { OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { TabBar } from "@/components/nav/TabBar";
import { renderWithI18n } from "@/test/utils/render";
import { adaPage, listedAlertNames, normalized, renderAlerts } from "@/test/utils/alerts";
import { restoreMatchMedia, stubLayoutBox, stubPhoneWidth } from "@/test/utils/viewport";
import {
  ALERT_COPY,
  ALERT_ID,
  ALERT_LABEL,
  adaAlert,
  DELETE_OK,
  FOLDED_LINE,
} from "@/test/fixtures/alert-listings";
import { deleteAlert } from "@/server/alerts/actions";
import { listFavorites } from "@/server/favorites/actions";

// docs/specs/redesign-alerts.md (ALERTUI-2, ALERTUI-13, ALERTUI-28,
// ALERTUI-40) at phone width: matchMedia reports `(width < 64rem)`, the query
// useIsPhone reads, so /alerts lists the phone AlertCards, each one link to
// its alert's page. The desktop composition is AlertsPage.test.tsx's.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/alerts",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-ada", name: "Ada" } }, isPending: false }),
  },
}));
vi.mock("@/server/favorites/actions", () => ({
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  listFavorites: vi.fn(),
}));
vi.mock("@/server/alerts/actions", () => ({ deleteAlert: vi.fn(), createAlert: vi.fn() }));
vi.mock("next/image", () => import("@/test/mocks/next-image"));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_CARTO_API_KEY: undefined } }));

stubLayoutBox({ width: 390 });

const NAMES = Object.values(ALERT_LABEL);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
  stubPhoneWidth();
  vi.mocked(listFavorites).mockResolvedValue({ ok: true, value: [] });
  vi.mocked(deleteAlert).mockResolvedValue(DELETE_OK);
});

afterEach(() => {
  restoreMatchMedia();
  vi.useRealTimers();
});

/** The phone AlertCards: links to an alert's page. */
function phoneCards(): HTMLAnchorElement[] {
  return screen
    .queryAllByRole("link")
    .filter((link): link is HTMLAnchorElement =>
      /^\/alerts\/[^/]+$/.test(link.getAttribute("href") ?? ""),
    );
}

/** The text of the elements `element`'s `aria-describedby` names, in order. */
function describedText(element: HTMLElement): string {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
}

function phoneCard(id: string): HTMLAnchorElement {
  const card = phoneCards().find((link) => link.getAttribute("href") === `/alerts/${id}`);
  expect(card, `the phone card of ${id}`).toBeDefined();
  return card as HTMLAnchorElement;
}

describe("ALERTUI-2: /alerts at phone width", () => {
  it("ALERTUI-2: shows «Alertas» and the alerts as phone cards, newest first, with no map, no «Nueva alerta», no line, no match and no «Eliminar»", () => {
    renderAlerts();

    expect(screen.getByRole("heading", { level: 1, name: ALERT_COPY.title })).toBeInTheDocument();
    expect(phoneCards().map((card) => card.getAttribute("href"))).toEqual([
      `/alerts/${ALERT_ID.corolla}`,
      `/alerts/${ALERT_ID.golf}`,
      `/alerts/${ALERT_ID.clio}`,
      `/alerts/${ALERT_ID.serie3}`,
    ]);
    expect(listedAlertNames(NAMES)).toEqual([
      "Corolla híbrido",
      "Golf TDI",
      "Clio barato",
      "Serie 3 diésel",
    ]);
    expect(screen.queryByRole("region", { name: ALERT_COPY.mapLabel })).not.toBeInTheDocument();
    expect(document.querySelector(".leaflet-container")).toBeNull();
    expect(screen.queryByRole("link", { name: ALERT_COPY.newAlert })).not.toBeInTheDocument();
    expect(screen.queryByText(ALERT_COPY.subtitle)).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole("link").filter((link) => link.getAttribute("target") === "_blank"),
    ).toEqual([]);
    expect(screen.queryByRole("button", { name: ALERT_COPY.deleteShort })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ALERT_COPY.delete })).not.toBeInTheDocument();
  });

  it("ALERTUI-2: the tab bar beside it has «Alertas» current", () => {
    renderWithI18n(<TabBar />, { locale: "es" });

    expect(screen.getByRole("link", { name: /Alertas/ })).toHaveAttribute("aria-current", "page");
  });
});

describe("ALERTUI-28: the phone AlertCard", () => {
  it("ALERTUI-28: is one link to /alerts/<id> holding the name, the count and the criteria on one line, with no date, no match and no «Eliminar»", () => {
    renderAlerts();
    const corolla = phoneCard(ALERT_ID.corolla);

    expect(within(corolla).getByText("Corolla híbrido")).toBeInTheDocument();
    expect(within(corolla).getByText("4 coincidencias")).toBeInTheDocument();
    expect(within(corolla).getByText(FOLDED_LINE.corolla)).toBeInTheDocument();
    expect(within(corolla).queryByText(/Creada el/)).not.toBeInTheDocument();
    expect(within(corolla).queryByRole("button")).toBeNull();
    expect(normalized(corolla.textContent)).not.toContain(ALERT_COPY.deleteShort);
  });

  it("ALERTUI-28: the counts read «4 coincidencias», «1 coincidencia», «Sin coincidencias» and «12 coincidencias» (ALERTUI-9)", () => {
    renderAlerts();

    expect(within(phoneCard(ALERT_ID.golf)).getByText("1 coincidencia")).toBeInTheDocument();
    expect(within(phoneCard(ALERT_ID.clio)).getByText("Sin coincidencias")).toBeInTheDocument();
    expect(within(phoneCard(ALERT_ID.serie3)).getByText("12 coincidencias")).toBeInTheDocument();
  });

  it("ALERTUI-28: «En pausa» shows on a paused alert's card", () => {
    renderAlerts(adaPage({ alerts: [adaAlert("corolla"), adaAlert("golf", { active: false })] }));

    expect(within(phoneCard(ALERT_ID.golf)).getByText(ALERT_COPY.paused)).toBeInTheDocument();
    expect(within(phoneCard(ALERT_ID.corolla)).queryByText(ALERT_COPY.paused)).toBeNull();
  });

  it("ALERTUI-28: on the phone «En pausa» opens the criteria line, before the summary, and not the name's row — Clio barato, paused, with no match", () => {
    renderAlerts(adaPage({ alerts: [adaAlert("clio", { active: false })] }));
    const clio = phoneCard(ALERT_ID.clio);

    const paused = within(clio).getByText(ALERT_COPY.paused);
    const criteria = within(clio).getByText(FOLDED_LINE.clio);
    expect(paused.parentElement).toBe(criteria.parentElement);
    expect(paused.nextElementSibling).toBe(criteria);
    const nameRow = within(clio).getByText("Clio barato").parentElement;
    expect(nameRow?.contains(paused)).toBe(false);
    expect(within(clio).getByText("Sin coincidencias")).toBeInTheDocument();
  });

  it("ALERTUI-28: a phone card is named by its alert and described by «En pausa», its count and its criteria", () => {
    renderAlerts(adaPage({ alerts: [adaAlert("clio", { active: false }), adaAlert("serie3")] }));

    expect(phoneCard(ALERT_ID.clio)).toHaveAccessibleName("Clio barato");
    expect(normalized(describedText(phoneCard(ALERT_ID.clio)))).toBe(
      normalized(`En pausa Sin coincidencias ${FOLDED_LINE.clio}`),
    );
    expect(normalized(describedText(phoneCard(ALERT_ID.serie3)))).toBe(
      normalized(`12 coincidencias ${FOLDED_LINE.serie3}`),
    );
  });

  it("ALERTUI-28: a card whose criteria no longer parse shows no criteria line", () => {
    renderAlerts(adaPage({ alerts: [adaAlert("golf", { criteria: {} })] }));

    expect(within(phoneCard(ALERT_ID.golf)).queryByText(/·/)).not.toBeInTheDocument();
  });
});

// docs/specs/motion.md (MOTION-19): the phone alert card's press changes with
// no transition.
describe("MOTION-19: the phone AlertCard never animates", () => {
  it("MOTION-19: the phone card carries no transition- class", () => {
    renderAlerts();

    expect(phoneCard(ALERT_ID.corolla).className).not.toMatch(/(^|\s)transition-/);
  });
});

describe("ALERTUI-13: the phone ignores `alert`", () => {
  it("ALERTUI-13: /alerts?alert=<Golf's id> lists the four phone cards, none open, and leaves the URL as it is", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderAlerts(adaPage({ openAlertId: ALERT_ID.golf }), {
      searchParams: `?alert=${ALERT_ID.golf}`,
      onUrlUpdate,
    });

    expect(phoneCards()).toHaveLength(4);
    expect(screen.queryByRole("article", { name: "Golf TDI" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { expanded: false })).toEqual([]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});

describe("ALERTUI-40: no alert at phone width", () => {
  it("ALERTUI-40: shows «Alertas», «¿Sin alertas?» over «Crea una», the phone line and «Buscar coches» to /map", () => {
    renderAlerts({ alerts: [], openAlertId: null, matches: [] });

    expect(screen.getByRole("heading", { level: 1, name: ALERT_COPY.title })).toBeInTheDocument();
    const empty = screen.getByRole("heading", { level: 2 });
    expect(empty).toHaveTextContent(ALERT_COPY.emptyTitle);
    expect(empty).toHaveTextContent(ALERT_COPY.emptyPunchline);
    expect(screen.getByText(ALERT_COPY.emptyLinePhone)).toBeInTheDocument();
    expect(screen.queryByText(ALERT_COPY.emptyLine)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: ALERT_COPY.emptyCta })).toHaveAttribute("href", "/map");
  });
});
