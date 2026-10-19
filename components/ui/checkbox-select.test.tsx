import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withAnimations } from "@/test/utils/animations";
import { CheckboxSelect } from "./checkbox-select";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-5: the select trigger
// turns its border to text-muted on hover while not focused, and moves to the
// lime focus border in the 120ms state transition (amends LOOK-13).

// LOOK-21 (docs/specs/redesign-foundation.md): the select has one style,
// always with checkboxes. `components/ui/checkbox-select.tsx` does not exist
// yet (Decisions and rationale: "The checkbox select is a new primitive") —
// this is the failing spec. Worked example: Combustible with Gasolina,
// Diésel and Híbrido chosen out of five options.
//
// jsdom computes no CSS from Tailwind, so `font-bold` / `bg-violet` below are
// class-name assertions — the contract is the exact utility class, never its
// rendered colour (docs/ARCHITECTURE.md › Testing).
const FUEL_OPTIONS = [
  { value: "gasolina", label: "Gasolina" },
  { value: "diesel", label: "Diésel" },
  { value: "hibrido", label: "Híbrido" },
  { value: "electrico", label: "Eléctrico" },
  { value: "glp", label: "GLP" },
];

function renderSelect(value: string[]) {
  const onChange = vi.fn();
  render(
    <CheckboxSelect label="Combustible" options={FUEL_OPTIONS} value={value} onChange={onChange} />,
  );
  return onChange;
}

function openSelect(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole("button", { name: /Combustible/ }));
}

describe("CheckboxSelect", () => {
  it("LOOK-21: the trigger lists the chosen labels separated by commas, with no digit", () => {
    renderSelect(["gasolina", "diesel", "hibrido"]);

    const trigger = screen.getByRole("button", { name: /Combustible/ });
    expect(trigger).toHaveTextContent("Gasolina, Diésel, Híbrido");
    expect(trigger.textContent ?? "").not.toMatch(/\d/);
  });

  it("LOOK-21: opening it shows a multi-select listbox with five options and the right aria-selected state", async () => {
    renderSelect(["gasolina", "diesel", "hibrido"]);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await openSelect(user);

    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-multiselectable", "true");
    expect(within(listbox).getAllByRole("option")).toHaveLength(5);

    expect(within(listbox).getByRole("option", { name: "Gasolina" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(listbox).getByRole("option", { name: "Diésel" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(listbox).getByRole("option", { name: "Híbrido" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(listbox).getByRole("option", { name: "Eléctrico" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(within(listbox).getByRole("option", { name: "GLP" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("LOOK-21: each option's checkbox data-state follows its aria-selected state", async () => {
    renderSelect(["gasolina", "diesel", "hibrido"]);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await openSelect(user);

    const listbox = screen.getByRole("listbox");
    const gasolina = within(listbox).getByRole("option", { name: "Gasolina" });
    const electrico = within(listbox).getByRole("option", { name: "Eléctrico" });

    const gasolinaCheckbox = gasolina.querySelector("[data-checkbox]");
    const electricoCheckbox = electrico.querySelector("[data-checkbox]");
    expect(gasolinaCheckbox, "Gasolina option has no [data-checkbox]").not.toBeNull();
    expect(electricoCheckbox, "Eléctrico option has no [data-checkbox]").not.toBeNull();

    expect(gasolinaCheckbox).toHaveAttribute("data-state", "checked");
    expect(electricoCheckbox).toHaveAttribute("data-state", "unchecked");
  });

  it("LOOK-21: a selected option is weight 700 with a violet box (class-name contract, see header comment)", async () => {
    renderSelect(["gasolina"]);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await openSelect(user);

    const listbox = screen.getByRole("listbox");
    const gasolina = within(listbox).getByRole("option", { name: "Gasolina" });
    expect(gasolina.className).toContain("font-bold");

    const checkbox = gasolina.querySelector("[data-checkbox]");
    expect(checkbox, "Gasolina option has no [data-checkbox]").not.toBeNull();
    expect(checkbox?.className).toContain("bg-violet");
  });

  it("LOOK-21: clicking an unselected option appends it to value, preserving order", async () => {
    const onChange = renderSelect(["gasolina", "diesel", "hibrido"]);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await openSelect(user);

    await user.click(screen.getByRole("option", { name: "Eléctrico" }));

    expect(onChange).toHaveBeenCalledWith(["gasolina", "diesel", "hibrido", "electrico"]);
  });

  it("LOOK-21: clicking a selected option removes it, keeping the rest in order", async () => {
    const onChange = renderSelect(["gasolina", "diesel", "hibrido"]);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await openSelect(user);

    await user.click(screen.getByRole("option", { name: "Gasolina" }));

    expect(onChange).toHaveBeenCalledWith(["diesel", "hibrido"]);
  });

  it("LOOK-21: an empty value shows a placeholder and selects nothing", async () => {
    renderSelect([]);

    const trigger = screen.getByRole("button", { name: /Combustible/ });
    expect(trigger.textContent ?? "").not.toMatch(/Gasolina|Diésel|Híbrido|Eléctrico|GLP/);

    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await openSelect(user);

    const listbox = screen.getByRole("listbox");
    for (const option of within(listbox).getAllByRole("option")) {
      expect(option).toHaveAttribute("aria-selected", "false");
    }
  });
});

describe("MOTION-5: CheckboxSelect — the trigger's hover and focus-border transition", () => {
  it("MOTION-5: the trigger carries hover:border-text-muted", () => {
    renderSelect([]);

    expect(screen.getByRole("button", { name: /Combustible/ }).className).toContain(
      "hover:border-text-muted",
    );
  });

  it("MOTION-5: the trigger carries a transition for its border colour", () => {
    renderSelect([]);

    const className = screen.getByRole("button", { name: /Combustible/ }).className;
    expect(className).toMatch(/transition-\[[^\]]*border-color[^\]]*\]|transition-colors/);
  });
});

/** No inline opacity below 1: drawn whole, with no fade in flight. */
function expectOpaque(element: HTMLElement) {
  const opacity = element.style.opacity;
  expect(opacity === "" || Number(opacity) >= 1).toBe(true);
}

// docs/specs/motion.md (MOTION-18): the select dropdown appears at once when
// opened with Enter, Space or an arrow key, and disappears at once with
// Escape; opened or closed with a pointer, it still fades.
describe("MOTION-18: CheckboxSelect — the dropdown opens and closes at once from the keyboard, but still animates for a pointer", () => {
  it.each(["{Enter}", "[Space]", "{ArrowDown}"])(
    "MOTION-18: %s on the trigger opens the dropdown with no inline opacity below 1, even with animations enabled",
    async (key) => {
      await withAnimations(async () => {
        renderSelect([]);
        screen.getByRole("button", { name: /Combustible/ }).focus();

        await userEvent.keyboard(key);

        expectOpaque(await screen.findByRole("listbox"));
      });
    },
  );

  it("MOTION-18: Escape closes the dropdown in the same tick, with no exit animation to wait for", async () => {
    await withAnimations(async () => {
      renderSelect([]);
      screen.getByRole("button", { name: /Combustible/ }).focus();
      await userEvent.keyboard("{Enter}");
      await screen.findByRole("listbox");

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("listbox", { hidden: true })).toBeNull();
    });
  });

  it("MOTION-18: a click on the trigger still fades the dropdown in, with an inline opacity below 1 right after", async () => {
    await withAnimations(async () => {
      renderSelect([]);
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      await openSelect(user);

      expect(Number((await screen.findByRole("listbox")).style.opacity)).toBeLessThan(1);
    });
  });

  it("MOTION-18: a click outside still plays the close animation — the dropdown is still mounted right after", async () => {
    await withAnimations(async () => {
      renderSelect([]);
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await openSelect(user);
      await screen.findByRole("listbox");

      await user.click(document.body);

      expect(screen.getByRole("listbox", { hidden: true })).toBeInTheDocument();
    });
  });
});

// docs/specs/motion.md (MOTION-22): moving the highlight through the
// dropdown with the arrow keys changes it at once, with no transition, as the
// type-ahead options do (MOTION-13).
describe("MOTION-22: CheckboxSelect — the arrow-key highlight changes at once", () => {
  it("MOTION-22: the option the arrow keys highlight carries no transition class", async () => {
    renderSelect([]);
    screen.getByRole("button", { name: /Combustible/ }).focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("listbox");

    await userEvent.keyboard("{ArrowDown}");

    const highlighted = screen
      .getAllByRole("option")
      .find((option) => option.hasAttribute("data-highlighted"));
    // Opening focuses Gasolina (the first option); ArrowDown moves the highlight to Diésel.
    expect(highlighted).toHaveAccessibleName("Diésel");
    expect(highlighted?.className).not.toMatch(/(^|\s)transition(-|\s|$)/);
  });
});
