import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

// docs/specs/motion.md (Key MOTION, Approved), MOTION-4: hover and press
// states, all moving in the 120ms state transition app/globals.css retimes
// (MOTION-1). jsdom computes no CSS, so these assert the exact utility
// classes; the real computed values are MOTION-3/MOTION-7's job in
// e2e/foundation.spec.ts.

describe("MOTION-4: Button — primary brightens slightly on hover", () => {
  it("MOTION-4: the primary variant carries a hover:brightness- class", () => {
    render(<Button variant="primary">Buscar</Button>);

    expect(screen.getByRole("button").className).toMatch(/hover:brightness-/);
  });
});

describe("MOTION-4: Button — secondary and outline turn their border to text-muted and fill with surface on hover", () => {
  it.each(["secondary", "outline"] as const)("MOTION-4: the %s variant", (variant) => {
    render(<Button variant={variant}>Cancelar</Button>);

    const className = screen.getByRole("button").className;
    expect(className).toContain("hover:border-text-muted");
    expect(className).toContain("hover:bg-surface");
  });
});

describe("MOTION-4: Button — ghost and icon fill with surface-strong on hover", () => {
  it.each(["ghost", "icon"] as const)("MOTION-4: the %s variant", (variant) => {
    render(<Button variant={variant}>Cerrar</Button>);

    expect(screen.getByRole("button").className).toContain("hover:bg-surface-strong");
  });
});

describe("MOTION-4: Button — every variant scales to 0.97 while pressed", () => {
  it.each(["primary", "secondary", "ghost", "undo", "danger", "icon"] as const)(
    "MOTION-4: the %s variant carries active:scale-97, off under reduced motion",
    (variant) => {
      render(<Button variant={variant}>Guardar</Button>);

      const className = screen.getByRole("button").className;
      expect(className).toContain("active:scale-97");
      expect(className).toContain("motion-reduce:active:scale-none");
    },
  );
});

describe("MOTION-4: Button — the undo variant keeps its instant colour change (LOOK-10)", () => {
  it("MOTION-4: the undo variant transitions no colour — no transition-colors, no bare transition, and color in none of its transition lists", () => {
    render(<Button variant="undo">Quitar filtros</Button>);

    const classes = screen.getByRole("button").className.split(/\s+/);
    expect(classes).not.toContain("transition-colors");
    expect(classes).not.toContain("transition");
    const lists = classes.flatMap((name) => {
      const list = /^transition-\[([^\]]+)\]$/.exec(name)?.[1];
      return list ? [list.split(",")] : [];
    });
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      expect(list).not.toContain("color");
    }
  });
});

describe("MOTION-17: Button — the danger variant turns its border to full danger on hover", () => {
  it.each(["danger", "destructive"] as const)("MOTION-17: the %s variant", (variant) => {
    render(<Button variant={variant}>Eliminar</Button>);

    expect(screen.getByRole("button").className).toContain("hover:border-danger");
  });
});
