import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { ES_COPY } from "@/test/utils/copy";
import * as pageModule from "./page";

// docs/specs/redesign-pages.md (PAGES-19), F7 — with no token at all,
// `/confirm-email` must show the same expired-link state as a
// server-rejected `tokenInvalid` (ConfirmEmailForm.test.tsx covers the
// latter).
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));

const ConfirmEmailPage = pageModule.default;

describe("PAGES-19: /confirm-email with no token at all", () => {
  it("PAGES-19: shows the same «¿Enlace caducado?» / «Pide otro» state as a server-rejected token", async () => {
    renderWithI18n(await ConfirmEmailPage({ searchParams: Promise.resolve({}) }), {
      locale: "es",
    });

    const heading = screen.getByRole("heading", { name: /¿Enlace caducado\?/ });
    expect(heading).toHaveTextContent("Pide otro");
    // PAGES-76: a state the page opens with takes no focus.
    expect(heading).not.toHaveFocus();
    expect(document.body).toHaveFocus();
    expect(
      screen.getByText(
        "Los enlaces duran 24 horas y solo valen una vez. Pide otro desde tu cuenta.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a tu cuenta" })).toHaveAttribute(
      "href",
      "/account",
    );
  });
});

// docs/specs/redesign-pages.md (PAGES-69, worked example "Browser titles").
describe("PAGES-69: /confirm-email's browser title", () => {
  it("PAGES-69: is exactly Confirma tu correo · Buy Car Map", async () => {
    const metadata = await pageModule.generateMetadata();

    expect(metadata.title).toBe("Confirma tu correo · Buy Car Map");
  });
});
