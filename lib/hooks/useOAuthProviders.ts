"use client";

import { useEffect, useState } from "react";
import { getProviders } from "next-auth/react";

// Which OAuth providers are actually configured is server-side knowledge (it
// depends on which secrets are present in the environment). NextAuth exposes it
// at /api/auth/providers; `getProviders` is the client wrapper for that.
//
// The buttons were previously hardcoded and did nothing at all, so a visitor
// could click "Google" forever with no feedback. Driving them off this list
// means an unconfigured provider is simply absent.
export function useOAuthProviders(): string[] {
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const available = await getProviders();

      // Guards against a state update after unmount, and against an earlier
      // response landing after a later one.
      if (cancelled || !available) return;

      setProviders(
        Object.values(available)
          .filter((provider) => provider.type === "oauth")
          .map((provider) => provider.id),
      );
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return providers;
}
