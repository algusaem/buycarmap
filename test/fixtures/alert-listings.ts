import type { AlertSummary, AlertWithMatches } from "@/interfaces/alert";
import type { CarListing } from "@/interfaces/listing";
import { asAlertId } from "@/lib/ids";
import type { SearchInput } from "@/lib/search/schema";

// docs/specs/redesign-alerts.md (ALERTUI) worked examples, as builders: Ada's
// four alerts of "Criteria" and "Open alert", newest first, their matches of
// "Page queries" and "Saved state", and the Spanish copy the tests read.
// Pure data, no vitest, so e2e/alerts-ui.spec.ts seeds the same alerts.

/** The alerts' ids: UUIDs, as the page's `alert` parameter carries them. */
export const ALERT_ID = {
  corolla: asAlertId("0199a000-0000-7000-8000-00000000c001"),
  golf: asAlertId("0199a000-0000-7000-8000-00000000c002"),
  clio: asAlertId("0199a000-0000-7000-8000-00000000c003"),
  serie3: asAlertId("0199a000-0000-7000-8000-00000000c004"),
  grace: asAlertId("0199a000-0000-7000-8000-00000000c005"),
};

export type AdaAlert = "corolla" | "golf" | "clio" | "serie3";

/** Madrid's point, the Corolla's and the Clio's zone (worked example "Criteria": any point). */
const MADRID = { latitude: 40.4168, longitude: -3.7038 } as const;
/** Valencia's point, the Golf's zone. */
const VALENCIA = { latitude: 39.4699, longitude: -0.3763 } as const;

/** The stored criteria of worked example "Criteria", row by row. */
export const ALERT_CRITERIA: Record<AdaAlert, SearchInput> = {
  corolla: {
    brand: "Toyota",
    model: "Corolla",
    engine: ["hybride", "hybride_plugin"],
    maxPrice: 18000,
    ...MADRID,
    distanceInKm: 50,
  },
  golf: {
    brand: "Volkswagen",
    model: "Golf",
    engine: ["gasoil"],
    maxKm: 120000,
    ...VALENCIA,
    distanceInKm: 25,
  },
  clio: { brand: "Renault", model: "Clio", maxPrice: 9000, ...MADRID, distanceInKm: 50 },
  serie3: { brand: "BMW", model: "Serie 3", engine: ["gasoil"], maxPrice: 20000 },
};

export const ALERT_LABEL: Record<AdaAlert, string> = {
  corolla: "Corolla híbrido",
  golf: "Golf TDI",
  clio: "Clio barato",
  serie3: "Serie 3 diésel",
};

export const ALERT_PLACE_NAME: Record<AdaAlert, string | null> = {
  corolla: "Madrid",
  golf: "Valencia",
  clio: null,
  serie3: null,
};

/** Worked example "Open alert": the creation dates, newest first. */
export const ALERT_CREATED_AT: Record<AdaAlert, string> = {
  corolla: "2026-10-02T10:00:00.000Z",
  golf: "2026-09-28T10:00:00.000Z",
  clio: "2026-09-21T10:00:00.000Z",
  serie3: "2026-09-14T10:00:00.000Z",
};

/** Newest first, as the page query returns them. */
export const ADA_ALERT_ORDER: readonly AdaAlert[] = ["corolla", "golf", "clio", "serie3"];

/**
 * The «Folded line» column of worked example "Criteria", joined by « · ».
 * Written with plain spaces: the page writes a U+00A0 before «km», which
 * getByText's default normaliser reads as a space, and
 * lib/search/alert-summary.test.ts asserts the U+00A0 itself.
 */
export const FOLDED_LINE: Record<AdaAlert, string> = {
  corolla: "Toyota Corolla · Híbrido · Hasta 18.000 € · Madrid · 50 km",
  golf: "Volkswagen Golf · Diésel · Hasta 120.000 km · Valencia · 25 km",
  clio: "Renault Clio · Hasta 9.000 € · 50 km",
  serie3: "BMW Serie 3 · Diésel · Hasta 20.000 €",
};

/** A match's snapshot, overriding only what a case is about. */
function makeAlertMatch(overrides: Partial<CarListing> = {}): CarListing {
  return {
    id: "wallapop-match-1",
    image: "https://cdn.wallapop.com/match-1.jpg",
    title: "Toyota Corolla 1.8 Hybrid",
    subtitle: "",
    price: 17500,
    mileage: 60000,
    year: 2020,
    fuel: "hybrid",
    brand: "Toyota",
    model: "Corolla",
    location: "Madrid",
    source: "Wallapop",
    lat: 40.42,
    lng: -3.7,
    url: "https://es.wallapop.com/item/match-1",
    ...overrides,
  };
}

/**
 * The Corolla's four matches, newest first. The newest is `cochesnet-99` of
 * worked example "Saved state": a Toyota Corolla 125H at 16.200 €.
 */
export function corollaMatches(): CarListing[] {
  return [
    makeAlertMatch({
      id: "cochesnet-99",
      title: "Toyota Corolla 125H",
      price: 16200,
      mileage: 41000,
      year: 2021,
      source: "Coches.net",
      location: "Getafe",
      lat: 40.3057,
      lng: -3.7327,
      url: "https://www.coches.net/toyota-corolla-125h-99.htm",
    }),
    makeAlertMatch({
      id: "wallapop-corolla-2",
      title: "Toyota Corolla 1.8 Hybrid Active",
      price: 17900,
      lat: 40.45,
      lng: -3.69,
      url: "https://es.wallapop.com/item/corolla-2",
    }),
    makeAlertMatch({
      id: "wallapop-corolla-3",
      title: "Toyota Corolla Touring Sports",
      price: 17200,
      year: 2019,
      lat: 40.48,
      lng: -3.62,
      url: "https://es.wallapop.com/item/corolla-3",
    }),
    makeAlertMatch({
      id: "milanuncios-corolla-4",
      title: "Toyota Corolla 2.0 Hybrid",
      price: 17990,
      source: "Milanuncios",
      lat: 40.36,
      lng: -3.8,
      url: "https://www.milanuncios.com/toyota-corolla-4.htm",
    }),
  ];
}

/** Serie 3's twelve titles, newest first: «BMW Serie 3 320d xDrive», then «BMW 318d 02» to «BMW 318d 12». */
export function serie3Title(n: number): string {
  return n === 1 ? "BMW Serie 3 320d xDrive" : `BMW 318d ${String(n).padStart(2, "0")}`;
}

/**
 * Serie 3 diésel's twelve matches, newest first (worked example "Page
 * queries"). The first two share one point, so the map draws eleven pins, one
 * of them grouped: «2 coches · desde 17.900 €», the 320d xDrive at 19.500 €
 * and the 318d 02 at 17.900 €. The others are 15.100 € to 16.000 €, each at
 * its own point.
 */
export function serie3Matches(): CarListing[] {
  return Array.from({ length: 12 }, (_, index) => {
    const n = index + 1;
    const shared = n <= 2;
    return makeAlertMatch({
      id: `wallapop-serie3-${String(n).padStart(2, "0")}`,
      title: serie3Title(n),
      brand: "BMW",
      model: "Serie 3",
      fuel: "gasoil",
      price: n === 1 ? 19500 : n === 2 ? 17900 : 15000 + n * 100 - 200,
      mileage: 90000 + n * 1000,
      year: 2017,
      location: "Sevilla",
      lat: shared ? 37.3891 : 37 + n * 0.1,
      lng: shared ? -5.9845 : -6 + n * 0.1,
      url: `https://es.wallapop.com/item/serie3-${n}`,
    });
  });
}

/** One of Ada's alerts as the /alerts page query returns it. */
export function adaAlert(which: AdaAlert, overrides: Partial<AlertSummary> = {}): AlertSummary {
  const matchCount = { corolla: 4, golf: 1, clio: 0, serie3: 12 }[which];
  return {
    id: ALERT_ID[which],
    label: ALERT_LABEL[which],
    placeName: ALERT_PLACE_NAME[which],
    criteria: ALERT_CRITERIA[which],
    matchCount,
    active: true,
    createdAt: new Date(ALERT_CREATED_AT[which]),
    ...overrides,
  };
}

/** Ada's four alerts, newest first. */
export function adaAlerts(): AlertSummary[] {
  return ADA_ALERT_ORDER.map((which) => adaAlert(which));
}

/** The Golf's one match. */
export function golfMatches(): CarListing[] {
  return [
    makeAlertMatch({
      id: "wallapop-golf-1",
      title: "Volkswagen Golf 2.0 TDI",
      brand: "Volkswagen",
      model: "Golf",
      fuel: "gasoil",
      price: 13900,
      mileage: 110000,
      year: 2018,
      location: "Valencia",
      lat: 39.47,
      lng: -0.38,
      url: "https://es.wallapop.com/item/golf-1",
    }),
  ];
}

/** Each alert's matches, as the fixture's `matchCount` counts them. */
function matchesOf(which: AdaAlert): CarListing[] {
  if (which === "corolla") return corollaMatches();
  if (which === "golf") return golfMatches();
  if (which === "serie3") return serie3Matches();
  return [];
}

/** One alert with every match, as /alerts/[id]'s page query returns it. */
export function alertWithMatches(
  which: AdaAlert,
  overrides: Partial<AlertWithMatches> = {},
): AlertWithMatches {
  const { id, label, placeName, criteria, active, createdAt } = adaAlert(which);
  return {
    id: asAlertId(id),
    label,
    placeName,
    criteria,
    active,
    createdAt,
    matches: matchesOf(which),
    ...overrides,
  };
}

/** The Spanish copy the alerts pages' tests press and read. */
export const ALERT_COPY = {
  title: "Alertas",
  subtitle: "El que no corre vuela, guárdalo y nosotros te avisamos.",
  newAlert: "Nueva alerta",
  mapLabel: "Mapa de la alerta",
  mapEmpty: "Aquí verás la zona de cada alerta",
  zoneLabel: "Zona de la alerta",
  paused: "En pausa",
  deleteShort: "Eliminar",
  delete: "Eliminar alerta",
  /** The confirmation's title, naming the alert (ALERTUI-33, ALERTUI-34; amended 2026-10-16). */
  confirmTitle: (name: string) => `¿Eliminar «${name}»?`,
  cancel: "Cancelar",
  noMatchesYet: "Te avisaremos en cuanto salga un coche que encaje.",
  emptyTitle: "¿Sin alertas?",
  emptyPunchline: "Crea una",
  emptyLine:
    "Busca lo que quieres en el mapa, pulsa «Crear alerta» y te escribimos cuando salga algo.",
  emptyLinePhone: "Busca en el mapa, pulsa «Crear alerta» y te avisamos.",
  emptyCta: "Buscar coches",
  back: "Volver",
  loading: "Cargando…",
  save: "Guardar",
  unsave: "Quitar de guardados",
  viewListing: "Ver anuncio",
  close: "Cerrar",
  unexpected: "Algo ha salido mal. Inténtalo de nuevo.",
  unauthenticated: "Inicia sesión para gestionar tus alertas.",
  favoriteUnauthenticated: "Inicia sesión para guardar coches.",
} as const;

/** What deleteAlert resolves to (`Result<void, AlertError>`, unchanged by F6). */
export const DELETE_OK = { ok: true as const, value: undefined };
export const DELETE_UNAUTHENTICATED = {
  ok: false as const,
  error: { code: "unauthenticated" as const, messageKey: "alertErrors.unauthenticated" },
};
