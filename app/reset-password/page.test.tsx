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

// docs/specs/redesign-pages.md (PAGES-24), F7 — with no token at all,
// `/reset-password` must show the same expired-link state as a
// server-rejected `tokenInvalid` (ResetPasswordForm.test.tsx covers the
// latter).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/server/password-reset/actions", () => ({
  resetPassword: vi.fn(),
}));

const ResetPasswordPage = pageModule.default;

describe("PAGES-24: /reset-password with no token at all", () => {
  it("PAGES-24: shows the same «¿Enlace caducado?» / «Pide otro» state as a server-rejected token", async () => {
    renderWithI18n(await ResetPasswordPage({ searchParams: Promise.resolve({}) }), {
      locale: "es",
    });

    const heading = screen.getByRole("heading", { name: /¿Enlace caducado\?/ });
    expect(heading).toHaveTextContent("Pide otro");
    // PAGES-76: a state the page opens with takes no focus.
    expect(heading).not.toHaveFocus();
    expect(document.body).toHaveFocus();
    expect(
      screen.getByText("Los enlaces duran una hora y solo valen una vez. Pide uno nuevo y listo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir otro enlace" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.getByRole("link", { name: "Volver a entrar" })).toBeInTheDocument();
  });
});

// docs/specs/redesign-pages.md (PAGES-69, worked example "Browser titles").
describe("PAGES-69: /reset-password's browser title", () => {
  it("PAGES-69: is exactly Nueva contraseña · Buy Car Map", async () => {
    const metadata = await pageModule.generateMetadata();

    expect(metadata.title).toBe("Nueva contraseña · Buy Car Map");
  });
});
