import { useEffect, useState } from "react";
import { listCarModels, type CarModel } from "@/server/search/actions";

interface ModelsState {
  models: CarModel[];
  loadedBrand: string;
}

// FRONT-4 (docs/specs/core-frontend.md): calls the listCarModels Server
// Action instead of fetching the (deleted) wallapop/filters/models proxy.
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
        const result = await listCarModels(brand);
        if (cancelled) return;
        setState({ models: result.ok ? result.value : [], loadedBrand: brand });
      } catch {
        // A rejected call (a network failure reaching the Server Action,
        // rather than the action itself returning an error Result) still
        // resolves to no models rather than leaving the hook loading forever.
        if (cancelled) return;
        setState({ models: [], loadedBrand: brand });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [brand]);

  const empty: CarModel[] = [];
  if (!brand) return { models: empty, isLoading: false };
  if (state.loadedBrand === brand) return { models: state.models, isLoading: false };
  return { models: empty, isLoading: true };
}
