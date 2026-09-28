import type { CochesNetTaxonomyOption, CochesNetTaxonomyResponse } from "@/interfaces/cochesnet";

// coches.net model list per make is static within a session, so cache it.
const modelsByMake = new Map<number, CochesNetTaxonomyOption[]>();

function normalize(name: string): string {
  return name.toLowerCase().trim();
}

async function fetchModels(makeId: number): Promise<CochesNetTaxonomyOption[]> {
  const cached = modelsByMake.get(makeId);
  if (cached) return cached;

  const url = new URL("/api/cochesnet/models", window.location.origin);
  url.searchParams.set("makeId", String(makeId));

  // Deliberately NOT cached on failure. Caching an empty list here would make
  // one transient blip disable model filtering for this make until the page is
  // reloaded — the cache is module-level and has no expiry, so nothing would
  // ever retry. Returning empty degrades this search to brand-only; the next
  // search tries again.
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return [];

  const data = (await response.json()) as CochesNetTaxonomyResponse;
  const options = data.items ?? [];
  modelsByMake.set(makeId, options);
  return options;
}

// The shared model filter stores the model NAME (Wallapop uses the name as its
// option id, e.g. "A3"). coches.net needs the numeric modelId, so resolve the
// name against its per-make model list. Returns undefined when no exact match
// exists, in which case the caller filters by make only.
export async function resolveCochesNetModelId(
  makeId: number,
  modelName: string,
): Promise<number | undefined> {
  const models = await fetchModels(makeId);
  const target = normalize(modelName);
  const match = models.find((m) => normalize(m.label) === target);
  return match?.id;
}
