"use client";

import type { ReactNode, RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence } from "motion/react";
import { PhoneBottomSheet } from "@/components/map/phone/SheetChrome";
import { PresenceFade } from "@/components/ui/PresenceFade";
import { cn } from "@/lib/utils";

// docs/specs/redesign-alerts.md (ALERTUI-33 to ALERTUI-35) and
// docs/specs/redesign-pages.md (PAGES-38, PAGES-72, PAGES-73). The one frame
// of a confirmation or a form that opens over a page: on desktop a centred
// dialog over the page dimmed to 72 % (380px, `surface`, a `line` border,
// `radius-card`, the float shadow, 20px of padding, 14px between pieces),
// fading in and out; on the phone the bottom sheet (PhoneBottomSheet: the
// handle, the centred title, no «×»). Escape, a press outside and a drag down
// call `onClose`, which carries the caller's own lock, and the focus goes back
// to `returnFocusRef` when it closes. Opened or closed from the keyboard, it
// appears and disappears at once (MOTION-12).

interface ResponsiveDialogProps {
  open: boolean;
  /** Escape, a press outside, a drag down: the caller decides whether it closes. */
  onClose: () => void;
  /** The bottom sheet below `lg`, the centred dialog from it. */
  isPhone: boolean;
  /** Where the focus goes when it closes. */
  returnFocusRef: RefObject<HTMLElement | null>;
  /** `alertdialog` for a confirmation; a plain dialog otherwise. */
  role?: "alertdialog";
  /** The control the focus starts on, when it is not the first focusable one. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** The handle stays, but the sheet does not follow it (a request that runs). */
  dragDisabled?: boolean;
  /** A body taller than the screen scrolls inside the frame (the account forms). */
  scrollable?: boolean;
  children: ReactNode;
}

export function ResponsiveDialog({
  open,
  onClose,
  isPhone,
  returnFocusRef,
  role,
  initialFocusRef,
  dragDisabled,
  scrollable = false,
  children,
}: ResponsiveDialogProps) {
  const focusInitial = (event: Event) => {
    if (!initialFocusRef?.current) return;
    event.preventDefault();
    initialFocusRef.current.focus();
  };

  if (isPhone) {
    return (
      <PhoneBottomSheet
        open={open}
        onClose={onClose}
        returnFocusRef={returnFocusRef}
        overlayClassName="bg-bg/72"
        className={cn(
          "gap-3.5 px-5 pb-sheet-bottom",
          scrollable && "max-h-sheet-max overflow-y-auto",
        )}
        entrance="slide"
        role={role}
        onOpenAutoFocus={focusInitial}
        dragDisabled={dragDisabled}
      >
        {children}
      </PhoneBottomSheet>
    );
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay forceMount asChild>
              <PresenceFade className="fixed inset-0 z-50 bg-bg/72" />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              forceMount
              asChild
              {...(role && { role })}
              aria-describedby={undefined}
              onOpenAutoFocus={focusInitial}
              onCloseAutoFocus={(event) => {
                if (!returnFocusRef.current) return;
                event.preventDefault();
                returnFocusRef.current.focus();
              }}
            >
              <PresenceFade
                className={cn(
                  "fixed top-1/2 left-1/2 z-50 flex w-95 -translate-x-1/2 -translate-y-1/2 flex-col gap-3.5 rounded-card border border-line bg-surface p-5 font-sans text-text shadow-float",
                  scrollable && "max-h-dialog-max overflow-y-auto overscroll-contain",
                )}
              >
                {children}
              </PresenceFade>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
