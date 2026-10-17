"use client";

import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { BusyButton } from "@/components/ui/BusyButton";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { type ActionRefusal, type ActionResult, settleAction } from "@/lib/auth/settle-action";
import { cn } from "@/lib/utils";

// docs/specs/redesign-pages.md (PAGES-38, PAGES-72, PAGES-73);
// AccountCard/README.md › Editar; F7-cuenta-editar, F7-cuenta-dos-pasos,
// F7-cuenta-sesiones-google, F7-cuenta-eliminar-y-mas. The frame every
// account card opens its form in: ResponsiveDialog, the frame DeleteAlertConfirm
// shares (the centred dialog on desktop over the page dimmed to 72 %, the
// bottom sheet on the phone), scrolling when its form is taller than the screen. «Cancelar»,
// Escape, a press outside and a drag down close it with nothing sent, and the
// focus goes back to the card's button. While its request runs none of those
// does anything (PAGES-72), and the codes panel never closes that way
// (PAGES-45). The focus starts on the first field, which is Radix's own
// default, unless the dialog names another control (PAGES-73). Its body
// mounts afresh on every opening, even one during the closing fade, so each
// opening starts from the form and reads what it reads again (PAGES-49).

interface AccountDialogContextValue {
  isPhone: boolean;
  busy: boolean;
  /**
   * Runs one request, holding the dialog open while it does (PAGES-72). A
   * request that throws reads as the `generic` refusal (settleAction).
   */
  run: <T extends ActionResult>(request: () => Promise<T>) => Promise<T | ActionRefusal>;
  /**
   * Keeps the dialog locked as a request does, for good: what follows a
   * request that left the page (the sign-out and the navigation after a
   * deletion, PAGES-54) can no longer be cancelled.
   */
  hold: () => void;
  /** Lets go of `hold` when what followed it failed and the page stays (a sign-out that throws). */
  release: () => void;
  /** «Cancelar»: closes, unless a request is running or the dialog cannot be dismissed. */
  close: () => void;
}

// Outside a dialog (a form rendered on its own) there is nothing to hold open.
const AccountDialogContext = createContext<AccountDialogContextValue>({
  isPhone: false,
  busy: false,
  run: (request) => settleAction(request),
  hold: () => undefined,
  release: () => undefined,
  close: () => undefined,
});

/** The open dialog's request lock, its width and its «Cancelar». */
export function useAccountDialog(): AccountDialogContextValue {
  return useContext(AccountDialogContext);
}

/** What the page hands every account dialog to open it in this frame. */
export interface AccountDialogFrameProps {
  open: boolean;
  /** Called when the user dismisses it: «Cancelar», Escape, a press outside, a drag down. */
  onClose: () => void;
  /** The bottom sheet below `lg`, the centred dialog from it. */
  isPhone: boolean;
  /** The card's button that opened it, focused again when it closes. */
  returnFocusRef: RefObject<HTMLElement | null>;
}

interface AccountDialogProps extends AccountDialogFrameProps {
  /** `alertdialog` for a confirmation: the codes and «¿Eliminar tu cuenta?». */
  role?: "alertdialog";
  /** False while it must stay until its own button closes it (the codes, PAGES-45). */
  dismissible?: boolean;
  /** The control the focus starts on, when it is not the first field (PAGES-73). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function AccountDialog({
  open,
  onClose,
  isPhone,
  returnFocusRef,
  role,
  dismissible = true,
  initialFocusRef,
  children,
}: AccountDialogProps) {
  const [running, setRunning] = useState(false);
  const [held, setHeld] = useState(false);
  const busy = running || held;
  // Counts the openings, so the body below remounts on each (PAGES-49).
  const [opening, setOpening] = useState(open ? 1 : 0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpening((count) => count + 1);
  }

  const close = useCallback(() => {
    if (busy || !dismissible) return;
    onClose();
  }, [busy, dismissible, onClose]);

  const run = useCallback(
    async <T extends ActionResult>(request: () => Promise<T>): Promise<T | ActionRefusal> => {
      setRunning(true);
      try {
        return await settleAction(request);
      } finally {
        setRunning(false);
      }
    },
    [],
  );

  const hold = useCallback(() => setHeld(true), []);
  const release = useCallback(() => setHeld(false), []);

  const context = useMemo(
    () => ({ isPhone, busy, run, hold, release, close }),
    [isPhone, busy, run, hold, release, close],
  );

  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      isPhone={isPhone}
      returnFocusRef={returnFocusRef}
      role={role}
      initialFocusRef={initialFocusRef}
      dragDisabled={busy || !dismissible}
      scrollable
    >
      <AccountDialogContext.Provider key={opening} value={context}>
        {children}
      </AccountDialogContext.Provider>
    </ResponsiveDialog>
  );
}

interface AccountDialogTitleProps {
  children: ReactNode;
}

/** The dialog's name: Unbounded 16 in capitals on desktop, the sheet's centred 15px title on the phone. */
export function AccountDialogTitle({ children }: AccountDialogTitleProps) {
  const { isPhone } = useAccountDialog();

  return (
    <DialogPrimitive.Title
      className={cn(
        "m-0 font-display font-extrabold text-balance wrap-break-word uppercase",
        isPhone ? "text-center text-sheet-title" : "text-card-title",
      )}
    >
      {children}
    </DialogPrimitive.Title>
  );
}

interface DialogCancelProps {
  /** «Cerrar» where nothing is left to cancel (the sent notice, Sesiones). */
  label?: string;
  ref?: RefObject<HTMLButtonElement | null>;
}

/** «Cancelar», a 44px ghost under the primary button: closes with nothing sent, but not while a request runs. */
export function DialogCancel({ label, ref }: DialogCancelProps) {
  const t = useTranslations();
  const { close } = useAccountDialog();

  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="44"
      onClick={close}
      className="w-full text-body-15"
    >
      {label ?? t("account.cancel")}
    </Button>
  );
}

interface DialogActionsProps {
  /** The primary button's label. */
  children: ReactNode;
  /** While its request runs (PAGES-2's busy). */
  busy: boolean;
  variant?: "primary" | "danger";
  /** Disabled for another of the dialog's requests (Gestionar's two). */
  disabled?: boolean;
  /**
   * `aria-disabled` until the form may be sent, «¿Eliminar tu cuenta?»'s gate
   * (PAGES-54): still focusable and announced, unlike `disabled`.
   */
  blocked?: boolean;
}

/**
 * A form dialog's footer (AccountCard/README.md › Editar): the 48px primary
 * (or danger) submit at full width, busy while its request runs, and
 * «Cancelar» under it.
 */
export function DialogActions({
  children,
  busy,
  variant = "primary",
  disabled,
  blocked,
}: DialogActionsProps) {
  return (
    <div className="mt-0.5 flex flex-col gap-1">
      <BusyButton
        type="submit"
        variant={variant}
        size="48"
        busy={busy}
        disabled={disabled}
        aria-disabled={blocked || undefined}
        className={cn(
          "w-full",
          blocked !== undefined && "aria-disabled:cursor-not-allowed aria-disabled:opacity-40",
        )}
      >
        {children}
      </BusyButton>
      <DialogCancel />
    </div>
  );
}
