import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { SearchField } from "./Combobox";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-5: the type-ahead
// field turns its border to text-muted on hover while not focused. The
// 120ms focus-border transition is already there (transition-[border-color]),
// unchanged by this spec.

describe("MOTION-5: SearchField — hover", () => {
  it("MOTION-5: the field's wrapper carries hover:border-text-muted", () => {
    renderWithI18n(
      <SearchField
        expanded={false}
        value=""
        onValueChange={vi.fn()}
        onClearText={vi.fn()}
        aria-label="Ciudad o código postal"
      />,
    );

    const field = screen.getByRole("combobox").closest("div");
    expect(field?.className).toContain("hover:border-text-muted");
  });
});

// docs/specs/motion.md (MOTION-13): the type-ahead field's clear button
// appears and disappears at once.
describe("MOTION-13: SearchField — the clear button appears and disappears at once", () => {
  function Harness({ initial = "" }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return (
      <SearchField
        expanded={false}
        value={value}
        onValueChange={setValue}
        onClearText={() => setValue("")}
        aria-label="Ciudad o código postal"
      />
    );
  }

  it("MOTION-13: typing shows the clear button with no inline opacity below 1, even with animations enabled", async () => {
    await withAnimations(async () => {
      renderWithI18n(<Harness />);

      await userEvent.type(screen.getByRole("combobox"), "M");

      const clear = await screen.findByRole("button", { name: "Clear text" });
      const opacity = clear.style.opacity;
      expect(opacity === "" || Number(opacity) >= 1).toBe(true);
    });
  });

  it("MOTION-13: clearing the text removes the button in the same tick", async () => {
    await withAnimations(async () => {
      renderWithI18n(<Harness initial="M" />);
      const clear = screen.getByRole("button", { name: "Clear text" });

      await userEvent.click(clear);

      expect(screen.queryByRole("button", { name: "Clear text" })).not.toBeInTheDocument();
    });
  });

  function HarnessWithSetButton() {
    const [value, setValue] = useState("");
    return (
      <>
        <button type="button" onClick={() => setValue("M")}>
          Set M
        </button>
        <SearchField
          expanded={false}
          value={value}
          onValueChange={setValue}
          onClearText={() => setValue("")}
          aria-label="Ciudad o código postal"
        />
      </>
    );
  }

  it('MOTION-13: a pointer click that sets the value to "M" shows the clear button with no inline opacity below 1, even with animations enabled', async () => {
    await withAnimations(async () => {
      renderWithI18n(<HarnessWithSetButton />);

      await userEvent.click(screen.getByRole("button", { name: "Set M" }));

      const clear = await screen.findByRole("button", { name: "Clear text" });
      const opacity = clear.style.opacity;
      expect(opacity === "" || Number(opacity) >= 1).toBe(true);
    });
  });
});

// docs/specs/motion.md (MOTION-17): the clear «×» gains a hover and a press
// state, in the state transition.
describe("MOTION-17: SearchField — hover and press on the clear button", () => {
  it("MOTION-17: the clear button carries hover:text-text and active:scale-97, off under reduced motion", () => {
    renderWithI18n(
      <SearchField
        expanded={false}
        value="M"
        onValueChange={vi.fn()}
        onClearText={vi.fn()}
        aria-label="Ciudad o código postal"
      />,
    );

    const className = screen.getByRole("button", { name: "Clear text" }).className;
    expect(className).toContain("hover:text-text");
    expect(className).toContain("active:scale-97");
    expect(className).toContain("motion-reduce:active:scale-none");
    expect(className).toMatch(/transition-\[[^\]]+\]/);
  });
});
