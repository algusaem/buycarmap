import "vitest";

// vitest-axe registers `toHaveNoViolations` at runtime (test/setup.jsdom.ts);
// declare it on Vitest's matcher interfaces so TypeScript knows about it.
declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
