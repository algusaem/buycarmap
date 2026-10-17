import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

// I18nProvider calls useRouter to refresh after a locale switch, which needs an
// app-router context this component never provides.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

// Scores 4: 20 characters, no sequence, keyboard run, repeat or blocklist hit.
const STRONG = "harbour-lentil-quilt";

// docs/specs/redesign-pages.md (PAGES-5): the label and level now sit on one
// line with the level word wrapped in its own element
// (`PasswordStrengthMeter.tsx`'s `<strong>`), so the line's text is split
// across siblings — a plain `getByText(exact string)` no longer finds it.
// Matches the full text of the innermost element that carries it, the same
// way `app/register/page.test.tsx` matches a paragraph split by links.
function strengthLine(text: string) {
  return screen.getByText((_, element) => element?.tagName === "P" && element.textContent === text);
}

describe("PasswordStrengthMeter", () => {
  it("renders nothing before the user has typed", () => {
    const { container } = renderWithI18n(<PasswordStrengthMeter password="" />);

    // An empty meter under an empty field is noise, and reads as "very weak"
    // before the user has done anything wrong.
    expect(container).toBeEmptyDOMElement();
  });

  it("rates a blocklisted password as the bottom band", () => {
    renderWithI18n(<PasswordStrengthMeter password="password" />);

    // amended 2026-10-16, PAGES-5: the label and level are one line now.
    expect(strengthLine("Strength: very weak")).toBeInTheDocument();
    expect(screen.getByText("This is a commonly used password")).toBeInTheDocument();
  });

  it("rates an unpredictable passphrase as the top band", () => {
    renderWithI18n(<PasswordStrengthMeter password={STRONG} />);

    // amended 2026-10-16, PAGES-5: the label and level are one line now.
    expect(strengthLine("Strength: strong")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("names each weakness it found rather than only the score", () => {
    // "abcdefgh1111" is long enough to clear the length rule, so the two issues
    // below are the only reason it scores low — the user needs to be told which.
    renderWithI18n(<PasswordStrengthMeter password="abcdefgh1111" />);

    expect(screen.getByText("Avoid sequences like “abcd” or “1234”")).toBeInTheDocument();
    expect(screen.getByText("Avoid repeating the same character")).toBeInTheDocument();
  });

  it("flags a password built out of the user's own email", () => {
    renderWithI18n(
      <PasswordStrengthMeter password="ada-lovelace-1815" userInputs={["ada@example.com"]} />,
    );

    expect(screen.getByText("Avoid using your name or email")).toBeInTheDocument();
    // amended 2026-10-16, PAGES-5: the label and level are one line now.
    expect(strengthLine("Strength: very weak")).toBeInTheDocument();
  });

  it("does not flag a password merely because inputs were supplied", () => {
    // Guards the check above against passing for any non-empty userInputs.
    renderWithI18n(<PasswordStrengthMeter password={STRONG} userInputs={["ada@example.com"]} />);

    expect(screen.queryByText("Avoid using your name or email")).not.toBeInTheDocument();
  });

  it("states the strength as text, not by colour alone", () => {
    // The bar is aria-hidden, so this line is the only thing a screen reader
    // or a colour-blind user has to go on.
    renderWithI18n(<PasswordStrengthMeter password="password" />);

    // amended 2026-10-16, PAGES-5: the label and level are one line now.
    expect(strengthLine("Strength: very weak")).toBeInTheDocument();
  });
});

// docs/specs/redesign-pages.md (PAGES-5), F7 — one combined line
// «Seguridad: <nivel>», the level in lower case, instead of today's separate
// "Password strength" label and a capitalised score ("Strong", "Very weak").
// Rendered in Spanish, since the criterion quotes the Spanish words
// themselves ("muy débil", "débil", "aceptable", "buena", "muy buena").
describe("PAGES-5: the combined «Seguridad: <nivel>» line", () => {
  // 12 distinct, scattered lowercase letters: not blocklisted, no 4-run
  // sequence or keyboard run, no repeat, no personal info — 56.4 bits of
  // estimated entropy (12 unique chars × log2(26)), which falls in
  // evaluatePassword's [45, 60) band for score 2, with zero issues
  // (hand-derived from lib/auth/password-strength.ts; not copied from its
  // output).
  const SCORE_2_NO_ISSUES = "fjzqvbkmxatl";

  it("PAGES-5: shows nothing while the field is empty", () => {
    const { container } = renderWithI18n(<PasswordStrengthMeter password="" />, {
      locale: "es",
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("PAGES-5: a password scored 2 with no issue reads «Seguridad: aceptable» as one line, plus the hint", () => {
    renderWithI18n(<PasswordStrengthMeter password={SCORE_2_NO_ISSUES} />, { locale: "es" });

    // amended 2026-10-16, PAGES-5: the level word is its own <strong>, so the
    // line's text is split across siblings.
    expect(strengthLine("Seguridad: aceptable")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tres o cuatro palabras sin relación entre sí forman una contraseña segura y fácil de recordar.",
      ),
    ).toBeInTheDocument();
  });

  it("PAGES-5: a password scored 4 reads «Seguridad: muy buena» as one line, with nothing listed under it", () => {
    renderWithI18n(<PasswordStrengthMeter password={STRONG} />, { locale: "es" });

    // amended 2026-10-16, PAGES-5: the level word is its own <strong>.
    expect(strengthLine("Seguridad: muy buena")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Tres o cuatro palabras sin relación entre sí forman una contraseña segura y fácil de recordar.",
      ),
    ).not.toBeInTheDocument();
  });

  it("PAGES-5: the blocklisted password reads «Seguridad: muy débil», lower case", () => {
    renderWithI18n(<PasswordStrengthMeter password="password" />, { locale: "es" });

    // amended 2026-10-16, PAGES-5: the level word is its own <strong>.
    expect(strengthLine("Seguridad: muy débil")).toBeInTheDocument();
  });

  // The worked example "Strength meter", first row (corrected 2026-10-16).
  // Hand-derived through evaluatePassword (lib/auth/password-strength.ts):
  // "wxyz" is 4 characters (tooShort), steps by one from w to z (a 4-run,
  // sequential), is no blocklisted form, no keyboard-row run, no repeat. Its
  // entropy is 4 unique × log2(26) ≈ 18.8 bits, × 0.55 for the sequence ≈
  // 10.3 bits, and under 12 characters a score under 40 bits is 0: «muy débil».
  it("PAGES-5: a 4-character password with a sequence reads «Seguridad: muy débil», lists both issues and shows no hint", () => {
    renderWithI18n(<PasswordStrengthMeter password="wxyz" />, { locale: "es" });

    // amended 2026-10-16, PAGES-5: the level word is its own <strong>.
    expect(strengthLine("Seguridad: muy débil")).toBeInTheDocument();
    expect(screen.getByText("Demasiado corta: usa al menos 12 caracteres")).toBeInTheDocument();
    expect(screen.getByText("Evita secuencias como “abcd” o “1234”")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Tres o cuatro palabras sin relación entre sí forman una contraseña segura y fácil de recordar.",
      ),
    ).not.toBeInTheDocument();
  });
});

// The worked example "Strength meter", scores 1 and 3 (decided 2026-10-16,
// session), hand-derived through evaluatePassword (lib/auth/password-strength.ts).
describe("PAGES-5: scores 1 and 3, either side of the hint", () => {
  const HINT =
    "Tres o cuatro palabras sin relación entre sí forman una contraseña segura y fácil de recordar.";

  // 12 characters, 7 unique (f j z q v b k) and 5 repeats: an effective length
  // of 7 + 5 × 0.4 = 9, × log2(26) ≈ 4.70 → 42.3 bits. No blocklisted form, no
  // 4-run, no keyboard run, no triple repeat: no issue, and 12 characters
  // under 45 bits is score 1.
  it("PAGES-5: «fjzqvbkfjzqv» reads «Seguridad: débil», lists nothing, and shows the hint", () => {
    renderWithI18n(<PasswordStrengthMeter password="fjzqvbkfjzqv" />, { locale: "es" });

    expect(strengthLine("Seguridad: débil")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  // 13 characters, all unique: 13 × 4.70 ≈ 61.1 bits, no issue — in [60, 80),
  // score 3, the hint's boundary.
  it("PAGES-5: «fjzqvbkmxatlw» reads «Seguridad: buena», lists nothing, and shows no hint", () => {
    renderWithI18n(<PasswordStrengthMeter password="fjzqvbkmxatlw" />, { locale: "es" });

    expect(strengthLine("Seguridad: buena")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});
