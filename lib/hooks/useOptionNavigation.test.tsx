import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { useOptionNavigation } from "./useOptionNavigation";

// docs/design/system/components/SearchPopover/README.md (Teclado): the arrows
// move the highlighted option, wrapping at both ends, and Enter chooses it.
// Driven through a real input so the keys arrive as they do in a combobox.
function Field({ count, choose }: { count: number; choose: (index: number) => void }) {
  const { highlighted, onKeyDown } = useOptionNavigation(count, choose);
  return <input aria-label="Campo" data-highlighted={highlighted} onKeyDown={onKeyDown} readOnly />;
}

function highlightedIndex() {
  return Number(screen.getByRole("textbox", { name: "Campo" }).dataset.highlighted);
}

describe("useOptionNavigation", () => {
  it("starts with nothing highlighted, and Enter then chooses nothing", async () => {
    const choose = vi.fn();
    renderWithI18n(<Field count={3} choose={choose} />);

    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));
    await userEvent.keyboard("{Enter}");

    expect(highlightedIndex()).toBe(-1);
    expect(choose).not.toHaveBeenCalled();
  });

  it("ArrowDown walks the options and wraps from the last back to the first", async () => {
    renderWithI18n(<Field count={3} choose={vi.fn()} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));

    await userEvent.keyboard("{ArrowDown}");
    expect(highlightedIndex()).toBe(0);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(highlightedIndex()).toBe(2);
    await userEvent.keyboard("{ArrowDown}");
    expect(highlightedIndex()).toBe(0);
  });

  it("ArrowUp from nothing highlighted goes to the last option, then up and around", async () => {
    renderWithI18n(<Field count={3} choose={vi.fn()} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));

    await userEvent.keyboard("{ArrowUp}");
    expect(highlightedIndex()).toBe(2);
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(highlightedIndex()).toBe(0);
    await userEvent.keyboard("{ArrowUp}");
    expect(highlightedIndex()).toBe(2);
  });

  it("Enter chooses the highlighted option", async () => {
    const choose = vi.fn();
    renderWithI18n(<Field count={3} choose={choose} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(choose).toHaveBeenCalledTimes(1);
    expect(choose).toHaveBeenCalledWith(1);
  });

  it("with no options, the keys highlight and choose nothing", async () => {
    const choose = vi.fn();
    renderWithI18n(<Field count={0} choose={choose} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));

    await userEvent.keyboard("{ArrowDown}{ArrowUp}{Enter}");

    expect(highlightedIndex()).toBe(-1);
    expect(choose).not.toHaveBeenCalled();
  });
});

// docs/specs/redesign-map.md (MAPUI-78, MAPUI-79): «Dónde» only — with
// nothing highlighted, Enter chooses the first listed instead of nothing.
function FirstChoosingField({ count, choose }: { count: number; choose: (index: number) => void }) {
  const { highlighted, onKeyDown } = useOptionNavigation(count, choose, true);
  return <input aria-label="Campo" data-highlighted={highlighted} onKeyDown={onKeyDown} readOnly />;
}

describe("useOptionNavigation — enterChoosesFirst (MAPUI-78, MAPUI-79)", () => {
  it("MAPUI-78: with nothing highlighted, Enter chooses the first listed", async () => {
    const choose = vi.fn();
    renderWithI18n(<FirstChoosingField count={3} choose={choose} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));

    await userEvent.keyboard("{Enter}");

    expect(choose).toHaveBeenCalledTimes(1);
    expect(choose).toHaveBeenCalledWith(0);
  });

  it("MAPUI-78: a highlighted option still wins over the first listed", async () => {
    const choose = vi.fn();
    renderWithI18n(<FirstChoosingField count={3} choose={choose} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(choose).toHaveBeenCalledTimes(1);
    expect(choose).toHaveBeenCalledWith(1);
  });

  it("MAPUI-79: closed with Escape, Enter chooses nothing", async () => {
    const choose = vi.fn();
    renderWithI18n(<FirstChoosingField count={3} choose={choose} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));

    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Enter}");

    expect(choose).not.toHaveBeenCalled();
  });

  it("MAPUI-79: with no options, Enter chooses nothing", async () => {
    const choose = vi.fn();
    renderWithI18n(<FirstChoosingField count={0} choose={choose} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));

    await userEvent.keyboard("{Enter}");

    expect(choose).not.toHaveBeenCalled();
  });

  it("MAPUI-78: after Escape, ArrowDown reopens the list and Enter chooses the first listed", async () => {
    const choose = vi.fn();
    renderWithI18n(<FirstChoosingField count={3} choose={choose} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));
    await userEvent.keyboard("{Escape}");

    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");

    expect(choose).toHaveBeenCalledTimes(1);
    expect(choose).toHaveBeenCalledWith(0);
  });
});

// MAP-20, MAPUI-2, MAPUI-21: Escape or a press outside closes the list without
// choosing; ArrowDown or a reset shows it again.
function ClosableField({ count, choose }: { count: number; choose: (index: number) => void }) {
  const { open, onKeyDown, reset, containerRef } = useOptionNavigation(count, choose);
  return (
    <div>
      <div ref={containerRef}>
        <input aria-label="Campo" data-open={open} onKeyDown={onKeyDown} readOnly />
        <button type="button" onClick={reset}>
          Reabrir
        </button>
      </div>
      <p>Fuera</p>
    </div>
  );
}

function isOpen() {
  return screen.getByRole("textbox", { name: "Campo" }).dataset.open === "true";
}

describe("useOptionNavigation — closing the list", () => {
  it("MAP-20: Escape closes the list and chooses nothing; Enter then chooses nothing", async () => {
    const choose = vi.fn();
    renderWithI18n(<ClosableField count={3} choose={choose} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));
    await userEvent.keyboard("{ArrowDown}");

    await userEvent.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    await userEvent.keyboard("{Enter}");

    expect(choose).not.toHaveBeenCalled();
  });

  it("MAP-20: ArrowDown shows a closed list again, with nothing highlighted", async () => {
    const choose = vi.fn();
    renderWithI18n(<ClosableField count={3} choose={choose} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));
    await userEvent.keyboard("{Escape}");

    await userEvent.keyboard("{ArrowDown}");
    expect(isOpen()).toBe(true);
    await userEvent.keyboard("{Enter}");

    expect(choose).not.toHaveBeenCalled();
  });

  it("MAP-20: a press outside the field closes the list; one inside does not", () => {
    renderWithI18n(<ClosableField count={3} choose={vi.fn()} />);
    expect(isOpen()).toBe(true);

    fireEvent.mouseDown(screen.getByRole("textbox", { name: "Campo" }));
    expect(isOpen()).toBe(true);

    fireEvent.mouseDown(screen.getByText("Fuera"));
    expect(isOpen()).toBe(false);
  });

  it("MAP-20: reset shows the list again", async () => {
    renderWithI18n(<ClosableField count={3} choose={vi.fn()} />);
    await userEvent.click(screen.getByRole("textbox", { name: "Campo" }));
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: "Reabrir" }));

    expect(isOpen()).toBe(true);
  });

  it("with no options the list is not open", () => {
    renderWithI18n(<ClosableField count={0} choose={vi.fn()} />);

    expect(isOpen()).toBe(false);
  });
});

// The ids the field and its options share: the listbox's, each option's, and
// the highlighted one as the field's `aria-activedescendant`.
function DescribedField({ count }: { count: number }) {
  const { onKeyDown, listboxId, optionId, activeDescendant } = useOptionNavigation(count, vi.fn());
  return (
    <>
      <input
        aria-label="Campo"
        aria-activedescendant={activeDescendant}
        onKeyDown={onKeyDown}
        readOnly
      />
      <ul id={listboxId} aria-label="Opciones">
        {Array.from({ length: count }, (_, index) => (
          <li key={optionId(index)} id={optionId(index)}>
            {`Opción ${index + 1}`}
          </li>
        ))}
      </ul>
    </>
  );
}

describe("useOptionNavigation — option ids", () => {
  it("each option's id is the listbox's id and its index", () => {
    renderWithI18n(<DescribedField count={2} />);

    const listboxId = screen.getByRole("list", { name: "Opciones" }).id;
    expect(listboxId).not.toBe("");
    expect(screen.getByText("Opción 1").id).toBe(`${listboxId}-0`);
    expect(screen.getByText("Opción 2").id).toBe(`${listboxId}-1`);
  });

  it("the active descendant is the highlighted option, and none before a highlight", async () => {
    renderWithI18n(<DescribedField count={2} />);
    const field = screen.getByRole("textbox", { name: "Campo" });
    expect(field).not.toHaveAttribute("aria-activedescendant");

    await userEvent.click(field);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");

    expect(field).toHaveAttribute("aria-activedescendant", screen.getByText("Opción 2").id);
  });

  it("MAP-20: a closed list leaves no active descendant", async () => {
    renderWithI18n(<DescribedField count={2} />);
    const field = screen.getByRole("textbox", { name: "Campo" });
    await userEvent.click(field);
    await userEvent.keyboard("{ArrowDown}");

    await userEvent.keyboard("{Escape}");

    expect(field).not.toHaveAttribute("aria-activedescendant");
  });
});
