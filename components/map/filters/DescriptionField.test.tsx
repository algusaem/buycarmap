import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { DescriptionField } from "./DescriptionField";

// docs/specs/map-description-search.md (Key DESC). DESC-4, DESC-5, DESC-8,
// DESC-9, DESC-10, DESC-15. Rendered in English (the default locale here),
// the Contracts table's en copy for the UI under test.

describe("DESC-4: DescriptionField — border state and Borrar texto", () => {
  it("DESC-4: with text applied, the field carries data-applied=true", () => {
    renderWithI18n(<DescriptionField applied="e46" onApply={vi.fn()} />);

    const field = screen.getByRole("searchbox", { name: "Search the description" });
    expect(field.closest("[data-applied]") ?? field).toHaveAttribute("data-applied", "true");
  });

  it("DESC-4: with no text applied, the field carries no data-applied=true", () => {
    renderWithI18n(<DescriptionField applied="" onApply={vi.fn()} />);

    const field = screen.getByRole("searchbox", { name: "Search the description" });
    const carrier = field.closest("[data-applied]") ?? field;
    expect(carrier).not.toHaveAttribute("data-applied", "true");
  });

  it("DESC-4: with text in the field, a Clear text button shows", async () => {
    renderWithI18n(<DescriptionField applied="" onApply={vi.fn()} />);

    await userEvent.type(screen.getByRole("searchbox", { name: "Search the description" }), "e46");

    expect(screen.getByRole("button", { name: "Clear text" })).toBeInTheDocument();
  });

  it("DESC-4: with the field empty, no Clear text button shows", () => {
    renderWithI18n(<DescriptionField applied="" onApply={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Clear text" })).not.toBeInTheDocument();
  });
});

describe("DESC-5: DescriptionField — the 100-character limit", () => {
  it("DESC-5: the field carries maxLength 100", () => {
    renderWithI18n(<DescriptionField applied="" onApply={vi.fn()} />);

    expect(screen.getByRole("searchbox", { name: "Search the description" })).toHaveAttribute(
      "maxLength",
      "100",
    );
  });

  it("DESC-5: typing 101 characters stops at 100", async () => {
    renderWithI18n(<DescriptionField applied="" onApply={vi.fn()} />);

    const field = screen.getByRole("searchbox", { name: "Search the description" });
    await userEvent.type(field, "a".repeat(101));

    expect(field).toHaveValue("a".repeat(100));
  });
});

describe("DESC-6/DESC-8: DescriptionField — Enter applies, blur does not", () => {
  it("DESC-6: Enter calls onApply with the trimmed text", async () => {
    const onApply = vi.fn();
    renderWithI18n(<DescriptionField applied="" onApply={onApply} />);

    const field = screen.getByRole("searchbox", { name: "Search the description" });
    await userEvent.type(field, "  e46 ");
    await userEvent.keyboard("{Enter}");

    expect(onApply).toHaveBeenCalledWith("e46");
  });

  it("DESC-8: leaving the field without Enter calls onApply with nothing", async () => {
    const onApply = vi.fn();
    renderWithI18n(
      <>
        <DescriptionField applied="" onApply={onApply} />
        <button type="button">elsewhere</button>
      </>,
    );

    await userEvent.type(screen.getByRole("searchbox", { name: "Search the description" }), "e46");
    await userEvent.click(screen.getByRole("button", { name: "elsewhere" }));

    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("DESC-9: DescriptionField — Borrar texto empties the field", () => {
  it("DESC-9: Clear text empties the field and calls onApply with an empty string", async () => {
    const onApply = vi.fn();
    renderWithI18n(<DescriptionField applied="e46" onApply={onApply} />);

    await userEvent.click(screen.getByRole("button", { name: "Clear text" }));

    expect(screen.getByRole("searchbox", { name: "Search the description" })).toHaveValue("");
    expect(onApply).toHaveBeenCalledWith("");
  });

  it("DESC-9: with nothing applied, Clear text empties the draft without calling onApply and refocuses the field", async () => {
    const onApply = vi.fn();
    renderWithI18n(<DescriptionField applied="" onApply={onApply} />);
    const field = screen.getByRole("searchbox", { name: "Search the description" });
    await userEvent.type(field, "e46");

    await userEvent.click(screen.getByRole("button", { name: "Clear text" }));

    expect(field).toHaveValue("");
    expect(onApply).not.toHaveBeenCalled();
    expect(field).toHaveFocus();
  });

  it("DESC-9: with text applied and typed over, Clear text calls onApply with an empty string and refocuses the field", async () => {
    const onApply = vi.fn();
    renderWithI18n(<DescriptionField applied="e46" onApply={onApply} />);
    const field = screen.getByRole("searchbox", { name: "Search the description" });
    await userEvent.type(field, "x");

    await userEvent.click(screen.getByRole("button", { name: "Clear text" }));

    expect(onApply).toHaveBeenCalledWith("");
    expect(field).toHaveFocus();
  });
});

describe("DESC-10: DescriptionField — emptying by hand or leaving only spaces", () => {
  it("DESC-10: emptying the field by hand and pressing Enter clears the applied text", async () => {
    const onApply = vi.fn();
    renderWithI18n(<DescriptionField applied="e46" onApply={onApply} />);

    const field = screen.getByRole("searchbox", { name: "Search the description" });
    await userEvent.clear(field);
    await userEvent.keyboard("{Enter}");

    expect(onApply).toHaveBeenCalledWith("");
  });

  it("DESC-10: leaving only spaces and pressing Enter clears the applied text", async () => {
    const onApply = vi.fn();
    renderWithI18n(<DescriptionField applied="e46" onApply={onApply} />);

    const field = screen.getByRole("searchbox", { name: "Search the description" });
    await userEvent.clear(field);
    await userEvent.type(field, "   ");
    await userEvent.keyboard("{Enter}");

    expect(onApply).toHaveBeenCalledWith("");
  });
});

describe("DESC-4: DescriptionField — typing over the applied text and deleting back to it", () => {
  it("DESC-4: typing past the applied text loses data-applied, deleting back to it restores it", async () => {
    renderWithI18n(<DescriptionField applied="e46" onApply={vi.fn()} />);
    const field = screen.getByRole("searchbox", { name: "Search the description" });
    const carrier = () => field.closest("[data-applied]") ?? field;

    await userEvent.type(field, "x");
    expect(field).toHaveValue("e46x");
    expect(carrier()).not.toHaveAttribute("data-applied", "true");

    await userEvent.keyboard("{Backspace}");
    expect(field).toHaveValue("e46");
    expect(carrier()).toHaveAttribute("data-applied", "true");
  });

  it("DESC-4: the violet border is a not-focus-within modifier, so focus never shows it", () => {
    renderWithI18n(<DescriptionField applied="e46" onApply={vi.fn()} />);
    const field = screen.getByRole("searchbox", { name: "Search the description" });
    const wrapper = field.closest("div");

    expect(wrapper?.className).toContain("not-focus-within:data-[applied]:border-violet");
  });
});

describe("DESC-5: DescriptionField — pasting past the 100-character limit", () => {
  it("DESC-5: pasting 101 characters stops at 100", async () => {
    renderWithI18n(<DescriptionField applied="" onApply={vi.fn()} />);
    const field = screen.getByRole("searchbox", { name: "Search the description" });
    field.focus();

    await userEvent.paste("a".repeat(101));

    expect(field).toHaveValue("a".repeat(100));
  });
});

describe("DESC-6: DescriptionField — Enter keeps the same input focused", () => {
  it("DESC-6: Enter applies the text and the same input keeps focus as the applied prop changes", async () => {
    function Harness() {
      const [applied, setApplied] = useState("");
      return <DescriptionField applied={applied} onApply={setApplied} />;
    }
    renderWithI18n(<Harness />);
    const field = screen.getByRole("searchbox", { name: "Search the description" });

    await userEvent.type(field, "e46");
    await userEvent.keyboard("{Enter}");

    const sameField = screen.getByRole("searchbox", { name: "Search the description" });
    expect(sameField).toHaveValue("e46");
    expect(sameField).toHaveFocus();
  });
});

describe("DESC-1: DescriptionField — placeholder", () => {
  it("DESC-1: shows the English placeholder", () => {
    renderWithI18n(<DescriptionField applied="" onApply={vi.fn()} />);

    expect(screen.getByPlaceholderText("Description: e46, gti…")).toBeInTheDocument();
  });

  it("DESC-1: shows the Spanish placeholder", () => {
    renderWithI18n(<DescriptionField applied="" onApply={vi.fn()} />, { locale: "es" });

    expect(screen.getByPlaceholderText("Descripción: e46, gti…")).toBeInTheDocument();
  });
});

describe("DESC-33: DescriptionField — Escape discards what was typed", () => {
  it("DESC-33: Escape restores the applied text and calls no onApply", async () => {
    const onApply = vi.fn();
    renderWithI18n(<DescriptionField applied="e46" onApply={onApply} />);
    const field = screen.getByRole("searchbox", { name: "Search the description" });

    await userEvent.type(field, "x");
    expect(field).toHaveValue("e46x");
    await userEvent.keyboard("{Escape}");

    expect(field).toHaveValue("e46");
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("DESC-33: DescriptionField — Escape notes the restored draft", () => {
  it("DESC-33: Escape's last onDraftChange call carries the applied text back", async () => {
    const onDraftChange = vi.fn();
    renderWithI18n(
      <DescriptionField applied="e46" onApply={vi.fn()} onDraftChange={onDraftChange} />,
    );
    const field = screen.getByRole("searchbox", { name: "Search the description" });

    await userEvent.type(field, "x");
    await userEvent.keyboard("{Escape}");

    expect(onDraftChange).toHaveBeenLastCalledWith("e46");
  });

  it("DESC-33: Escape's keydown is prevented, so dispatching it returns false", () => {
    renderWithI18n(<DescriptionField applied="e46" onApply={vi.fn()} />);
    const field = screen.getByRole("searchbox", { name: "Search the description" });

    const dispatched = fireEvent.keyDown(field, { key: "Escape" });

    expect(dispatched).toBe(false);
  });
});

describe("DESC-9: DescriptionField — Clear text notes the emptied draft", () => {
  it("DESC-9: Clear text's last onDraftChange call carries an empty string", async () => {
    const onDraftChange = vi.fn();
    renderWithI18n(<DescriptionField applied="" onApply={vi.fn()} onDraftChange={onDraftChange} />);
    const field = screen.getByRole("searchbox", { name: "Search the description" });
    await userEvent.type(field, "e46");

    await userEvent.click(screen.getByRole("button", { name: "Clear text" }));

    expect(onDraftChange).toHaveBeenLastCalledWith("");
  });
});

describe("DESC-15: DescriptionField — resets to the applied text from outside, no remount", () => {
  it("DESC-15: applied changing from outside replaces the draft", () => {
    const { rerender } = renderWithI18n(<DescriptionField applied="e46" onApply={vi.fn()} />);
    expect(screen.getByRole("searchbox", { name: "Search the description" })).toHaveValue("e46");

    rerender(<DescriptionField applied="gti" onApply={vi.fn()} />);
    expect(screen.getByRole("searchbox", { name: "Search the description" })).toHaveValue("gti");

    rerender(<DescriptionField applied="" onApply={vi.fn()} />);
    expect(screen.getByRole("searchbox", { name: "Search the description" })).toHaveValue("");
  });

  it("DESC-15: a new resetKey discards the typed draft and shows the applied text again", async () => {
    const { rerender } = renderWithI18n(
      <DescriptionField applied="e46" resetKey={0} onApply={vi.fn()} />,
    );
    const field = screen.getByRole("searchbox", { name: "Search the description" });
    await userEvent.type(field, "x");
    expect(field).toHaveValue("e46x");

    rerender(<DescriptionField applied="e46" resetKey={1} onApply={vi.fn()} />);

    expect(screen.getByRole("searchbox", { name: "Search the description" })).toHaveValue("e46");
  });
});
