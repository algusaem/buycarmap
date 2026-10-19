"use client";

import type { ComponentProps, PointerEvent, ReactNode, Ref, RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AnimatePresence,
  animate,
  type PanInfo,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import * as motion from "motion/react-client";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PresenceFade } from "@/components/ui/PresenceFade";
import { crossFade, sheetSlideUp, sheetSpring } from "@/lib/animations";
import { usePresenceMotion } from "@/lib/hooks/usePresenceMotion";
import { useReleaseSampling } from "@/lib/hooks/useReleaseSampling";
import { FLICK_VELOCITY } from "@/lib/map/sheet-position";
import { cn } from "@/lib/utils";

// docs/design/system/components/SearchPopover/README.md (la hoja «BUSCAR») and
// FilterSheet/README.md: the frame the «BUSCAR» sheet and the filters panel
// share. A 70px header with the 40px close button (visually hidden in the
// «BUSCAR» sheet, which closes by dragging its handle down), the Unbounded title (the
// dialog's `h2`, over the sections' `h3`s) and the underlined «Borrar», and a
// footer with the 56px «Ver coches». Also the bottom-sheet frame the «BUSCAR»
// sheet and Crear alerta's phone sheet share (PhoneBottomSheet). A sheet opened
// from the keyboard appears at once, and one closed with Escape or a close
// control pressed with a key leaves at once; a pointer keeps the fade or the
// slide both ways (MOTION-12).

/**
 * A phone dialog's `onCloseAutoFocus`: the focus goes back to the control
 * that opened it. The dialogs are opened from controls outside any
 * `Dialog.Trigger`, so Radix alone has nowhere to return it.
 */
function returnFocusTo(opener: RefObject<HTMLElement | null> | undefined) {
  return (event: Event) => {
    if (!opener?.current) return;
    event.preventDefault();
    opener.current.focus();
  };
}

const SHEET_MOTION = { fade: crossFade, slide: sheetSlideUp };

const BOTTOM_SHEET_CLASS =
  "fixed inset-x-0 bottom-0 z-50 flex flex-col overscroll-contain rounded-t-sheet border-t border-line bg-surface pt-2.5 font-sans text-text";
// The filters panel's phone dialog (FilterPanel.tsx's PhoneFilterPanel): a
// full-screen dialog over the whole viewport instead of a bottom sheet, so it
// needs no dimmed overlay underneath it and no handle on top.
const FULL_SCREEN_CLASS =
  "fixed inset-0 z-50 flex flex-col overscroll-contain bg-bg pt-safe-top font-sans text-text lg:hidden";

interface PhoneBottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** The control that opened the sheet, focused again when it closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** The dimmed screen behind the sheet: its fill, and when it shows. Unused by a `fullScreen` sheet. */
  overlayClassName?: string;
  /** The sheet's own padding, gaps, height and breakpoint, over the shared frame. */
  className?: string;
  /** How the sheet comes in and goes: fading, or sliding up from the bottom. */
  entrance: keyof typeof SHEET_MOTION;
  contentRef?: Ref<HTMLDivElement>;
  onOpenAutoFocus?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** A full-screen dialog instead of a bottom sheet: no dimmed overlay, no handle. */
  fullScreen?: boolean;
  /** `alertdialog` for a confirmation (docs/specs/redesign-alerts.md, ALERTUI-34); a plain dialog otherwise. */
  role?: "alertdialog";
  /** The handle stays, but the sheet does not follow it: a confirmation while its delete runs (ALERTUI-34). */
  dragDisabled?: boolean;
  children: ReactNode;
}

// docs/specs/redesign-saved.md (SAVED-37 to SAVED-39, worked example "Drag to
// close"); BottomSheet/README.md › Arrastrar para cerrar. How far down the
// handle must go, in px, or how fast the release must move down, in px/s, for
// the sheet to close; anything less springs it back. The speed is the results
// sheet's flick threshold (FLICK_VELOCITY, MAPUI-60), measured the same way,
// from the pointer events (samplePress, MOTION-20).
const DRAG_CLOSE_OFFSET = 100;
/** How much the sheet gives when pulled up past where it sits. */
const DRAG_TOP_ELASTIC = 0.1;

/** Whether letting go of the handle closes the sheet (SAVED-39). */
export function shouldDragClose(offsetY: number, velocityY: number): boolean {
  return offsetY > DRAG_CLOSE_OFFSET || velocityY > FLICK_VELOCITY;
}

/**
 * A modal bottom sheet on a phone (BottomSheet/README.md › Hojas modales): a
 * Radix dialog over the dimmed screen, `surface`, the top `line` border and
 * `radius-sheet` corners, with the 40 × 5 `handle` centred on top. It shows no
 * close «×»: it closes when its handle is dragged down (SheetPanel), with
 * Escape or a press outside, and gives the focus back to its opener
 * (returnFocusTo). The caller draws the title (a `Dialog.Title`) and
 * everything under the handle. `fullScreen` covers the whole viewport instead
 * (the filters panel's phone dialog): neither the dimmed overlay, the handle
 * nor the drag apply then.
 */
export function PhoneBottomSheet({
  open,
  onClose,
  returnFocusRef,
  overlayClassName,
  className,
  entrance,
  contentRef,
  onOpenAutoFocus,
  onEscapeKeyDown,
  fullScreen = false,
  role,
  dragDisabled = false,
  children,
}: PhoneBottomSheetProps) {
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
            {!fullScreen && (
              <DialogPrimitive.Overlay forceMount asChild>
                <PresenceFade className={cn("fixed inset-0 z-50", overlayClassName)} />
              </DialogPrimitive.Overlay>
            )}
            <DialogPrimitive.Content
              forceMount
              asChild
              aria-describedby={undefined}
              {...(role && { role })}
              onOpenAutoFocus={onOpenAutoFocus}
              onEscapeKeyDown={onEscapeKeyDown}
              onCloseAutoFocus={returnFocusTo(returnFocusRef)}
              className={cn(fullScreen ? FULL_SCREEN_CLASS : BOTTOM_SHEET_CLASS, className)}
            >
              <SheetPanel
                ref={contentRef}
                preset={SHEET_MOTION[entrance]}
                draggable={!fullScreen}
                dragDisabled={dragDisabled}
                onDragClose={onClose}
              >
                {children}
              </SheetPanel>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

type SheetPanelProps = Omit<ComponentProps<typeof motion.div>, "children"> & {
  /** How it comes in and goes (SHEET_MOTION), instant from the keyboard (usePresenceMotion). */
  preset: (typeof SHEET_MOTION)[keyof typeof SHEET_MOTION];
  /** A bottom sheet: the handle on top, which drags the sheet down to close it. */
  draggable: boolean;
  /** The handle is drawn but the sheet stays put. */
  dragDisabled?: boolean;
  onDragClose: () => void;
  children: ReactNode;
};

/**
 * The sheet itself, the Radix dialog's content. Mounted on each opening, so a
 * drag never carries over to the next one. The drag starts from the handle
 * strip only (`dragListener={false}`), so the sheet's own scroll is never
 * taken over: down it follows the finger, up it barely gives. On release it
 * closes past the threshold (shouldDragClose), or springs back, at once with
 * reduced motion. The release's speed is read from the handle's own pointer
 * events (samplePress), never from Motion's drag velocity, which reads 0 on a
 * flick drawn in one frame on an idle page (MOTION-20).
 */
function SheetPanel({
  preset,
  draggable,
  dragDisabled = false,
  onDragClose,
  children,
  style,
  ...props
}: SheetPanelProps) {
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const presence = usePresenceMotion(preset);
  // The press/release sampling (MOTION-20) the handle drives, shared with the results sheet.
  const { releaseVelocityRef, start: startSampling } = useReleaseSampling();

  function startDrag(event: PointerEvent) {
    dragControls.start(event);
    startSampling(event);
  }

  // Motion calls it after the frame is drawn, so the press's pointerup has already set releaseVelocityRef.
  function onDragEnd(_event: globalThis.PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (shouldDragClose(info.offset.y, releaseVelocityRef.current)) {
      onDragClose();
      return;
    }
    if (reduceMotion) {
      y.set(0);
      return;
    }
    animate(y, 0, sheetSpring);
  }

  return (
    <motion.div
      {...presence}
      {...props}
      style={{ ...style, y }}
      drag={draggable && !dragDisabled ? "y" : false}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragConstraints={{ top: 0 }}
      dragElastic={{ top: DRAG_TOP_ELASTIC }}
      onDragEnd={onDragEnd}
    >
      {draggable && (
        // The strip over the sheet's top padding and the handle, full width,
        // a little into the gap under it: what a thumb grabs. Pointer-only:
        // the keyboard closes with Escape or «Cerrar».
        <div
          data-sheet-handle=""
          aria-hidden="true"
          onPointerDown={startDrag}
          className="relative z-10 -mt-2.5 -mb-2 flex shrink-0 cursor-grab touch-none justify-center self-stretch pt-2.5 pb-2 active:cursor-grabbing"
        >
          <span className="h-1.25 w-10 rounded-pill bg-handle" />
        </div>
      )}
      {children}
    </motion.div>
  );
}

interface ClearButtonProps {
  onClick: () => void;
}

export function ClearButton({ onClick }: ClearButtonProps) {
  const t = useTranslations();
  return (
    <Button
      type="button"
      variant="ghost"
      size="pad-14"
      className="px-0 underline underline-offset-2"
      onClick={onClick}
    >
      {t("search.clear")}
    </Button>
  );
}

interface SheetHeaderProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  onClear: () => void;
  /**
   * A bottom sheet's header (the «BUSCAR» sheet): the close button is
   * visually hidden, for screen readers and the keyboard, and shows in its
   * place only with keyboard focus (SAVED-41). The full-screen filters panel
   * keeps it drawn.
   */
  hideClose?: boolean;
}

/** The phone header: close, the dialog's title, «Borrar». Inside a Radix Dialog only. */
export function SheetHeader({
  title,
  closeLabel,
  onClose,
  onClear,
  hideClose = false,
}: SheetHeaderProps) {
  return (
    <div className="grid h-17.5 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-line-soft px-5">
      {/* Its own grid cell, so a hidden close (out of the flow) still leaves
          the title in the middle column. */}
      <span className="flex justify-self-start">
        <Button
          type="button"
          variant="icon"
          size="icon-40"
          aria-label={closeLabel}
          onClick={onClose}
          className={cn(
            hideClose &&
              "sr-only not-focus-visible:size-px focus-visible:not-sr-only focus-visible:size-10",
          )}
        >
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      </span>
      <DialogPrimitive.Title className="m-0 font-display text-base font-extrabold uppercase">
        {title}
      </DialogPrimitive.Title>
      <span className="justify-self-end">
        <ClearButton onClick={onClear} />
      </span>
    </div>
  );
}

interface ShowCarsFooterProps {
  onShowCars: () => void;
}

export function ShowCarsFooter({ onShowCars }: ShowCarsFooterProps) {
  const t = useTranslations();
  return (
    <div className="shrink-0 border-t border-line-soft px-5 pt-3.5 pb-sheet-footer">
      <Button type="button" variant="primary" size="display" onClick={onShowCars}>
        {t("search.showCars")}
      </Button>
    </div>
  );
}
