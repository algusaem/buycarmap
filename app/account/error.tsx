"use client";

import { PageStateError } from "@/components/ui/PageStateError";

// docs/specs/redesign-pages.md (PAGES-57; amends FRONT-14, PLAT-14): a failed
// read of /account is the page-error state with «Reintentar» and «Volver al
// mapa», under /account's own header, with the pages header's 32px sides. The
// thrown error is never shown.
interface AccountErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AccountError({ error, reset }: AccountErrorProps) {
  return <PageStateError sides="pages" error={error} reset={reset} />;
}
