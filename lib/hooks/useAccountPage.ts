import { type MouseEvent, useRef, useState } from "react";

// docs/specs/redesign-pages.md (PAGES-38, PAGES-40, PAGES-42, PAGES-45 to
// PAGES-48, PAGES-53): what /account keeps while its dialogs change it — the
// name, the user row's version (DATA-15), whether two-factor is on, the
// linked providers, the recovery codes on screen — so the cards follow
// without a reload, and which dialog is open, with the card's button it came
// from, focused again when it closes.

export type AccountDialogKey = "name" | "email" | "password" | "twoFactor" | "sessions" | "delete";

/** The codes on screen, and what minted them: closing them after enabling confirms it (PAGES-47). */
export interface ShownCodes {
  codes: string[];
  source: "enable" | "regenerate";
}

interface AccountPageInitial {
  name: string | null;
  version: number;
  twoFactorEnabled: boolean;
  providers: string[];
}

export function useAccountPage(initial: AccountPageInitial) {
  const [name, setName] = useState(initial.name);
  const [version, setVersion] = useState(initial.version);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(initial.twoFactorEnabled);
  const [providers, setProviders] = useState(initial.providers);
  const [codes, setCodes] = useState<ShownCodes | null>(null);
  const [dialog, setDialog] = useState<AccountDialogKey | null>(null);
  // The card's button the open dialog came from, focused again when it closes.
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const close = () => setDialog(null);

  /** The version an action answered with, once it moved the row on (DATA-15). */
  const takeVersion = (next: number | undefined) => {
    if (next !== undefined) setVersion(next);
  };

  return {
    name,
    version,
    twoFactorEnabled,
    providers,
    codes,
    dialog,
    openerRef,
    close,
    /** A card's button: opens its dialog, the two-factor one from its first step. */
    open: (key: AccountDialogKey) => (event: MouseEvent<HTMLButtonElement>) => {
      openerRef.current = event.currentTarget;
      if (key === "twoFactor") setCodes(null);
      setDialog(key);
    },
    /** «Cambiar nombre» saved (PAGES-40). */
    nameSaved: (saved: string | null, next: number | undefined) => {
      setName(saved);
      takeVersion(next);
      close();
    },
    /** «Cambiar contraseña» saved (PAGES-42). */
    passwordSaved: (next: number | undefined) => {
      takeVersion(next);
      close();
    },
    showCodes: setCodes,
    /**
     * «Ya los he guardado» (PAGES-45, PAGES-47): closes the codes, and answers
     * whether they came from enabling two-factor, which is then on.
     */
    codesSaved: () => {
      const enabled = codes?.source === "enable";
      if (enabled) setTwoFactorEnabled(true);
      close();
      return enabled;
    },
    /** «Desactivar dos pasos» succeeded (PAGES-48). */
    twoFactorDisabled: () => {
      setTwoFactorEnabled(false);
      close();
    },
    /** «Desconectar» succeeded (PAGES-53). */
    googleUnlinked: () => setProviders((current) => current.filter((p) => p !== "google")),
  };
}
