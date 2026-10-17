import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { ES_COPY } from "@/test/utils/copy";
import * as pageModule from "./page";

// docs/specs/redesign-entry.md (ENTRY-9, ENTRY-19, ENTRY-20). LoginPage is a
// plain (non-async) Server Component today, so it renders directly through
// renderWithI18n like any client component — no `await LoginPage()` needed.
// It reaches LoginForm, so the same mocks LoginForm.test.tsx uses are
// required here too.
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));
vi.mock("@/server/auth/actions", () => ({
  signIn: vi.fn(),
  verifySignInTotp: vi.fn(),
  verifySignInBackupCode: vi.fn(),
}));
// `next-intl/server`'s real implementation only resolves under the
// "react-server" module condition Next.js sets at build time — absent here,
// it falls back to a client-only stub that throws. Stubbed with `ES_COPY.t`
// (test/utils/copy.ts) instead, so `generateMetadata`'s string is the real
// Spanish copy, not a hand-written lookup.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));

const LoginPage = pageModule.default;

describe("ENTRY-20: the sign-in page's browser title", () => {
  it("ENTRY-20: is exactly Entrar · Buy Car Map", async () => {
    const metadata = await pageModule.generateMetadata();

    expect(metadata.title).toBe("Entrar · Buy Car Map");
  });
});

describe("ENTRY-9: /login — the copy and the links", () => {
  it("ENTRY-9: shows the headline, the Entrar form, ¿La olvidaste? beside Contraseña, and Créala linking to /register", () => {
    searchParams = new URLSearchParams();
    renderWithI18n(<LoginPage />, { locale: "es" });

    expect(screen.getByRole("heading", { name: /¿Te mola un coche\?/ })).toHaveTextContent(
      "Guárdalo",
    );
    expect(
      screen.getByText("Recibir alertas es gratis, regístrate y nos encargamos del resto."),
    ).toBeInTheDocument();

    // "Entrar" names the form's own title — a heading distinct from the
    // submit button of the same name, checked separately below.
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();

    expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "tu@email.com");
    expect(screen.getByPlaceholderText("Tu contraseña")).toBeInTheDocument();

    // vitest.config.ts sets GOOGLE_CLIENT_ID, so Google is configured here —
    // the "o" divider and its button are expected, not merely possible.
    expect(screen.getByText("o")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeInTheDocument();

    const forgotPassword = screen.getByRole("link", { name: "¿La olvidaste?" });
    expect(forgotPassword).toHaveAttribute("href", "/forgot-password");
    // ENTRY-9: "beside «Contraseña», and outside it" — the link is the
    // label's sibling in the row above the field, never nested inside the
    // <label for="password"> itself.
    const passwordLabel = document.querySelector('label[for="password"]');
    if (!passwordLabel) throw new Error("expected a label[for=password]");
    expect(within(passwordLabel as HTMLElement).queryByText("¿La olvidaste?")).toBeNull();

    expect(screen.getByText(/¿No tienes cuenta\?/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Créala" })).toHaveAttribute("href", "/register");
  });
});

describe("ENTRY-19: /login — the illustration", () => {
  it("ENTRY-19: renders by-my-car-lime.svg as a same-origin image", () => {
    searchParams = new URLSearchParams();
    const { container } = renderWithI18n(<LoginPage />, { locale: "es" });

    // The desktop/phone placement difference this criterion also describes
    // (panel vs. none, «o» shown vs. hidden, Google with vs. without its
    // mark) is a CSS/breakpoint distinction jsdom cannot render — left to the
    // Playwright screenshots RULES.md §22.5 requires before this ships, not
    // asserted here.
    expect(container.querySelector('img[src*="by-my-car-lime.svg"]')).not.toBeNull();
  });

  it("ENTRY-19: renders it twice — desktop and phone — with the phone one after Créala", () => {
    searchParams = new URLSearchParams();
    const { container } = renderWithI18n(<LoginPage />, { locale: "es" });

    const images = container.querySelectorAll('img[src*="by-my-car-lime.svg"]');
    expect(images).toHaveLength(2);
    const creala = screen.getByRole("link", { name: "Créala" });
    // DOCUMENT_POSITION_FOLLOWING (4): the second image comes after Créala.
    expect(
      creala.compareDocumentPosition(images[1]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
