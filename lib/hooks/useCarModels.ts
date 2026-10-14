import { useEffect, useState } from "react";
import { createExternalStore, useExternalStore } from "@/lib/hooks/createExternalStore";
import { listCarModels, type CarModel } from "@/server/search/actions";

// FRONT-4 (docs/specs/core-frontend.md): calls the listCarModels Server
// Action instead of fetching the (deleted) wallapop/filters/models proxy.
//
// docs/specs/redesign-map.md (Contracts › Brand list): each brand's models are
// cached for the session, once per brand, shared by every type-ahead and every
// slot of `useModelNames`, so moving back to a brand already asked for does
// not ask again. Two sources can both return «Corolla», so each name is kept
// once, ignoring case. A failed request is not cached: the type-ahead shows no
// models for it (MAPUI-10), and asking for that brand again retries.

const EMPTY: CarModel[] = [];

/** Each brand's models, once loaded; only successful loads are kept. */
const modelsCache = createExternalStore<ReadonlyMap<string, CarModel[]>>(new Map());

/** The requests in flight, so two type-aheads asking for one brand share one call. */
const inFlight = new Map<string, Promise<boolean>>();

/** The models, each name once ignoring case, in their first order. */
function uniqueByName(models: CarModel[]): CarModel[] {
  const seen = new Set<string>();
  return models.filter(({ label }) => {
    const key = label.toLocaleLowerCase();
    if (!label || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Loads a brand's models into the cache; false when the request failed. */
async function loadModels(brand: string): Promise<boolean> {
  try {
    const result = await listCarModels(brand);
    if (!result.ok) return false;
    const next = new Map(modelsCache.get());
    next.set(brand, uniqueByName(result.value));
    modelsCache.set(next);
    return true;
  } catch {
    // A rejected call (a network failure reaching the Server Action, rather
    // than the action itself returning an error Result) is a failed load like
    // any other: reported to the caller, not cached (MAPUI-10).
    return false;
  }
}

async function requestModels(brand: string): Promise<boolean> {
  const pending = inFlight.get(brand);
  if (pending) return pending;

  const request = loadModels(brand);
  inFlight.set(brand, request);
  try {
    return await request;
  } finally {
    inFlight.delete(brand);
  }
}

/**
 * Empties the session's cache. The cache is module state shared by every
 * caller, so a test resets it to start each case from no models loaded.
 */
export function clearCarModelsCache(): void {
  modelsCache.set(new Map());
  inFlight.clear();
}

export function useCarModels(brand: string) {
  const cached = useExternalStore(modelsCache).get(brand);
  // The brand whose request failed in this type-ahead. Moving to another
  // brand forgets it, so coming back to it asks again.
  const [failedBrand, setFailedBrand] = useState<string | null>(null);
  if (failedBrand !== null && failedBrand !== brand) setFailedBrand(null);

  useEffect(() => {
    if (!brand || cached) return;

    let cancelled = false;
    async function load() {
      const loaded = await requestModels(brand);
      if (!cancelled && !loaded) setFailedBrand(brand);
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [brand, cached]);

  if (!brand) return { models: EMPTY, isLoading: false };
  if (cached) return { models: cached, isLoading: false };
  if (failedBrand === brand) return { models: EMPTY, isLoading: false };
  return { models: EMPTY, isLoading: true };
}

/**
 * docs/specs/redesign-map.md (MAPUI-6): the model names of up to three
 * brands, one list per brand in the same order.
 */
export function useModelNames(brands: string[]): string[][] {
  const loads = [
    useCarModels(brands[0] ?? ""),
    useCarModels(brands[1] ?? ""),
    useCarModels(brands[2] ?? ""),
  ];
  return brands
    .slice(0, loads.length)
    .map((_, index) => loads[index]?.models.map((carModel) => carModel.label) ?? []);
}
