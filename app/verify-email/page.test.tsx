import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { ES_COPY } from "@/test/utils/copy";
import * as pageModule from "./page";

// `next-intl/server`'s real implementation only resolves under the
// "react-server" module condition Next.js sets at build time — absent here,
// stubbed with `ES_COPY.t` (test/utils/copy.ts), as app/privacy/page.test.tsx does.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));

// docs/specs/redesign-pages.md (PAGES-16), F7 — with no token at all,
// `/verify-email` must show the same expired-link state as a server-rejected
// `tokenInvalid` (components/auth/VerifyRegistrationForm.test.tsx covers the
// latter).
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/server/registration/actions", () => ({
  verifyRegistration: vi.fn(),
}));

const VerifyEmailPage = pageModule.default;

describe("PAGES-16: /verify-email with no token at all", () => {
  it("PAGES-16: shows the same «¿Enlace caducado?» / «Regístrate otra vez» state as a server-rejected token", async () => {
    renderWithI18n(await VerifyEmailPage({ searchParams: Promise.resolve({}) }), {
      locale: "es",
    });

    const heading = screen.getByRole("heading", { name: /¿Enlace caducado\?/ });
    expect(heading).toHaveTextContent("Regístrate otra vez");
    // PAGES-76: a state the page opens with takes no focus.
    expect(heading).not.toHaveFocus();
    expect(document.body).toHaveFocus();
    expect(
      screen.getByText(
        "Los enlaces de confirmación duran 24 horas y solo valen una vez. Vuelve a registrarte y te mandamos otro.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al registro" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });
});

// docs/specs/redesign-pages.md (PAGES-69, worked example "Browser titles").
describe("PAGES-69: /verify-email's browser title", () => {
  it("PAGES-69: is exactly Confirma tu cuenta · Buy Car Map", async () => {
    const metadata = await pageModule.generateMetadata();

    expect(metadata.title).toBe("Confirma tu cuenta · Buy Car Map");
  });
});
