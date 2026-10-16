"use client";

import { type RefObject, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PhoneBottomSheet } from "@/components/map/phone/SheetChrome";
import { Button } from "@/components/ui/button";
import { crossFade } from "@/lib/animations";

// docs/specs/redesign-alerts.md (ALERTUI-33 to ALERTUI-35);
// F6-alerta-escritorio and F6-alerta-estados; Button/README.md › Peligro.
// «¿Eliminar «<nombre>»?», naming the alert, with «Eliminar» (danger) and
// «Cancelar» (ghost), 4px apart. On desktop a centred dialog over the page dimmed to 72 %:
// `surface`, a `line` border, `radius-card`, the float shadow, 380px and 20px
// of padding, with no handle and no «×», fading in and out. On the phone the
// bottom sheet, with its handle and no «×» or «Cerrar»: it closes by
// dragging the handle down (SAVED-37 to SAVED-41). Either is an
// `alertdialog`, and «Cancelar» takes the focus, the safe choice. While the
// delete runs «Eliminar» shows a spinner, both buttons are disabled, and the
// focus waits on the confirmation itself, so it never falls out of it.

interface DeleteAlertConfirmProps {
  open: boolean;
  /** The alert's name, which the title quotes (ALERTUI-33, ALERTUI-34). */
  name: string;
  /** The bottom sheet below `lg`, the centred dialog from it. */
  isPhone: boolean;
  /** True while the delete runs. */
  deleting: boolean;
  /** Where the focus goes when it closes: its opener, or after a delete the page's heading. */
  returnFocusRef: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteAlertConfirm({
  open,
  name,
  isPhone,
  deleting,
  returnFocusRef,
  onCancel,
  onConfirm,
}: DeleteAlertConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const focusCancel = (event: Event) => {
    event.preventDefault();
    cancelRef.current?.focus();
  };
  const body = (
    <ConfirmBody
      name={name}
      deleting={deleting}
      cancelRef={cancelRef}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );

  if (isPhone) {
    return (
      <PhoneBottomSheet
        open={open}
        onClose={onCancel}
        returnFocusRef={returnFocusRef}
        overlayClassName="bg-bg/72"
        className="gap-3.5 px-5 pb-sheet-bottom"
        entrance="slide"
        role="alertdialog"
        onOpenAutoFocus={focusCancel}
        // A drag refused while the delete runs would leave the sheet where it was let go.
        dragDisabled={deleting}
      >
        {body}
      </PhoneBottomSheet>
    );
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay forceMount asChild>
              <motion.div {...crossFade} className="fixed inset-0 z-50 bg-bg/72" />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              forceMount
              asChild
              role="alertdialog"
              aria-describedby={undefined}
              onOpenAutoFocus={focusCancel}
              onCloseAutoFocus={(event) => {
                if (!returnFocusRef.current) return;
                event.preventDefault();
                returnFocusRef.current.focus();
              }}
            >
              <motion.div
                {...crossFade}
                className="fixed top-1/2 left-1/2 z-50 flex w-95 -translate-x-1/2 -translate-y-1/2 flex-col gap-3.5 rounded-card border border-line bg-surface p-5 font-sans text-text shadow-float"
              >
                {body}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

interface ConfirmBodyProps {
  name: string;
  deleting: boolean;
  cancelRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * «Eliminar» is about to be disabled: the focus moves to the confirmation
 * (Radix's content, a `tabIndex=-1` focus scope) first, as a disabled button
 * loses it to the page's body, outside the dialog.
 */
function holdFocusInConfirmation(button: HTMLElement) {
  const confirmation = button.closest('[role="alertdialog"]');
  if (confirmation instanceof HTMLElement) confirmation.focus();
}

/** The title and the two buttons, the same in the dialog and in the sheet. */
function ConfirmBody({ name, deleting, cancelRef, onCancel, onConfirm }: ConfirmBodyProps) {
  const t = useTranslations();

  return (
    <>
      <DialogPrimitive.Title className="m-0 text-center font-display text-sheet-title font-extrabold text-balance wrap-break-word uppercase">
        {t("alerts.deleteConfirmNamed", { name })}
      </DialogPrimitive.Title>
      <div className="mt-0.5 flex flex-col gap-1">
        <Button
          type="button"
          variant="danger"
          size="44"
          disabled={deleting}
          onClick={(event) => {
            holdFocusInConfirmation(event.currentTarget);
            onConfirm();
          }}
          className="w-full"
        >
          {deleting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
          {t("alerts.deleteShort")}
        </Button>
        <Button
          ref={cancelRef}
          type="button"
          variant="ghost"
          size="44"
          disabled={deleting}
          onClick={onCancel}
          className="w-full text-body-15"
        >
          {t("alerts.cancel")}
        </Button>
      </div>
    </>
  );
}
