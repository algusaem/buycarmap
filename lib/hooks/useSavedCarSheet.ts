import { useRef, useState } from "react";
import type { CarListing } from "@/interfaces/listing";

// docs/specs/redesign-saved.md (SAVED-20 to SAVED-22): the phone's car sheet —
// the car it shows, whether it is open, and the control the focus goes back
// to when it closes. Where the focus goes after a removal is
// lib/hooks/useRemovalFocus.ts's.

export function useSavedCarSheet() {
  const [listing, setListing] = useState<CarListing | null>(null);
  const [open, setOpen] = useState(false);
  // The row that opened the sheet, where the focus returns when it closes;
  // after a removal, the item that takes the focus instead (SAVED-18, SAVED-21).
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return {
    /** The car the sheet shows, kept while it plays its exit. */
    listing,
    open,
    returnFocusRef,
    openSheet: (car: CarListing, row: HTMLButtonElement) => {
      returnFocusRef.current = row;
      setListing(car);
      setOpen(true);
    },
    closeSheet: () => setOpen(false),
  };
}
