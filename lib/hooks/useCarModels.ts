import { useEffect, useState } from "react";
import { WallapopFilterOption } from "@/interfaces/wallapop";
import { fetchModelsByBrand } from "@/lib/wallapop/filters";

interface ModelsState {
  models: WallapopFilterOption[];
  loadedBrand: string;
}

export function useCarModels(brand: string) {
  const [state, setState] = useState<ModelsState>({
    models: [],
    loadedBrand: "",
  });

  useEffect(() => {
    if (!brand) return;

    let cancelled = false;

    async function load() {
      try {
        const response = await fetchModelsByBrand(brand);
        if (!cancelled) {
          setState({ models: response.options ?? [], loadedBrand: brand });
        }
      } catch {
        if (!cancelled) {
          setState({ models: [], loadedBrand: brand });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [brand]);

  const empty: WallapopFilterOption[] = [];
  if (!brand) return { models: empty, isLoading: false };
  if (state.loadedBrand === brand) return { models: state.models, isLoading: false };
  return { models: empty, isLoading: true };
}
