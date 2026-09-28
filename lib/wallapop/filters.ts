import type { WallapopFilterResponse } from "@/interfaces/wallapop";

export async function fetchModelsByBrand(brand: string): Promise<WallapopFilterResponse> {
  const url = new URL("/api/wallapop/filters/models", window.location.origin);
  url.searchParams.set("brand", brand);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  return response.json() as Promise<WallapopFilterResponse>;
}
