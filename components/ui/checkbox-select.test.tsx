import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckboxSelect } from "./checkbox-select";

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
