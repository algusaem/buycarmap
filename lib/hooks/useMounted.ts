import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {
  /* nothing to subscribe to: mounted state never changes after mount */
};

export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
