import { vi } from "vitest";
import { describeAlertsRouteError } from "@/test/utils/alerts";

// I18nProvider calls useRouter() for its locale-switch refresh.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  usePathname: () => "/alerts/alert-1",
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));
vi.mock("maplibre-gl", () => import("@/test/utils/maplibre"));
// test/utils/alerts.tsx also renders the alert pages, whose actions reach the server.
vi.mock("@/server/alerts/actions", () => ({ deleteAlert: vi.fn(), createAlert: vi.fn() }));
vi.mock("@/server/favorites/actions", () => ({
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  listFavorites: vi.fn(),
}));

import AlertMatchesError from "./error";

// PLAT-14 (docs/specs/core-platform.md) and docs/specs/redesign-alerts.md
// (ALERTUI-42): /alerts/[id]'s error.tsx, with the tests both alert routes share
// (test/utils/alerts.tsx).
describeAlertsRouteError("AlertMatchesError", AlertMatchesError, refresh);
