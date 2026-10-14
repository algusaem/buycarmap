"use client";

import { Button } from "@/components/ui/button";

// docs/design/system/components/SearchPopover/README.md: the footer of the
// three search popovers — «Toda España», «Cualquier marca», «Cualquier
// precio» — a 44px ghost button across the popover that clears its segment.
interface PopoverResetButtonProps {
  children: string;
  onClick: () => void;
}

export function PopoverResetButton({ children, onClick }: PopoverResetButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="44"
      className="w-full text-body-15"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
