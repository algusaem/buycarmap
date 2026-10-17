import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { ES_COPY } from "@/test/utils/copy";
import * as pageModule from "./page";

// `next-intl/server`'s real implementation only resolves under the
// "react-server" module condition Next.js sets at build time — absent here,
// stubbed with `ES_COPY.t` (test/utils/copy.ts), as app/privacy/page.test.tsx does.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));

// docs/specs/redesign-pages.md (PAGES-1, PAGES-9), F7 — the parts of
// `/register`'s composition that live in the page itself rather than in
// RegisterForm (RegisterForm.test.tsx covers the form's own headline,
// fields, states and submission): no decorative background, no brand block,
// the legal notice's links, and the footer. Reuses RegisterForm.test.tsx's
// mocks, since RegisterPage renders RegisterForm.
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signIn: { email: vi.fn() } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/server/registration/actions", () => ({
  register: vi.fn(),
  resendConfirmation: vi.fn(),
}));

const RegisterPage = pageModule.default;

describe("PAGES-1: no grid, no gradient orbs, no pulsing icons and no «BuyCarMap» brand block", () => {
  it("PAGES-1: renders no element the decorative background or brand header drew", () => {
    const { container } = renderWithI18n(<RegisterPage />, { locale: "es" });

    expect(screen.queryByRole("heading", { name: "BuyCarMap" })).not.toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(container.querySelector("#grid-large")).toBeNull();
  });
});

describe("PAGES-9: the legal notice, at every width", () => {
  it("PAGES-9: shows «Al crear tu cuenta aceptas los Términos y la Privacidad.», linking to /terms and /privacy", () => {
    renderWithI18n(<RegisterPage />, { locale: "es" });

    // The sentence holds its two links, so it is matched on the paragraph's
    // whole text rather than on its own text nodes alone.
    const notice = screen.getByText(
      (_, element) =>
        element?.tagName === "P" &&
        /Al crear tu cuenta aceptas los Términos y la Privacidad\./.test(element.textContent ?? ""),
    );
    expect(notice).toBeInTheDocument();
    // amended 2026-10-16: scoped to the legal notice — the Footer has its own
    // «Términos» link, so an unscoped query matches two elements.
    expect(within(notice).getByRole("link", { name: "Términos" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(within(notice).getByRole("link", { name: "Privacidad" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});

describe("PAGES-1: the footer", () => {
  it("PAGES-1: renders the page's footer", () => {
    renderWithI18n(<RegisterPage />, { locale: "es" });

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});

// docs/specs/redesign-pages.md (PAGES-69, worked example "Browser titles").
describe("PAGES-69: /register's browser title", () => {
  it("PAGES-69: is exactly Crear cuenta · Buy Car Map", async () => {
    const metadata = await pageModule.generateMetadata();

    expect(metadata.title).toBe("Crear cuenta · Buy Car Map");
  });
});
