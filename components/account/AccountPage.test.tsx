import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { axe } from "vitest-axe";
import {
  ACCOUNT_COPY,
  albaAccount,
  albaWithFiveSessions,
  albaWithTwoSessions,
  googleOnlyAccount,
  SUMMARY_LINE_CASES,
} from "@/test/fixtures/pages-account";
import { renderAccount, withinCard } from "@/test/utils/pages-account";
import { stubLayoutBox } from "@/test/utils/viewport";

// docs/specs/redesign-pages.md (PAGES-25 to PAGES-60, PAGES-71 to PAGES-73,
// PAGES-76) for /account at desktop width, jsdom's default
// (test/setup.jsdom.ts stubs matchMedia to match nothing, so useIsPhone
// reports desktop). The phone composition is AccountPage.phone.test.tsx's.
// The clock is frozen on the worked examples' day, 2026-10-16, so «hace 2
// días» and the summary line's year read as they say.

const { push, refresh, captureException } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock("@sentry/nextjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/nextjs")>()),
  captureException,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
const signOut = vi.fn();
const signInEmail = vi.fn();
const notify = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signOut: (...a: unknown[]) => signOut(...a),
    signIn: { email: (...a: unknown[]) => signInEmail(...a) },
    $store: { notify: (...a: unknown[]) => notify(...a) },
  },
}));

const updateProfile = vi.fn();
const changePassword = vi.fn();
const unlinkAccount = vi.fn();
const listMySessions = vi.fn();
const revokeMySession = vi.fn();
const revokeOtherMySessions = vi.fn();
const signOutEverywhere = vi.fn();
const deleteAccount = vi.fn();
vi.mock("@/server/account/actions", () => ({
  updateProfile: (...a: unknown[]) => updateProfile(...a),
  changePassword: (...a: unknown[]) => changePassword(...a),
  unlinkAccount: (...a: unknown[]) => unlinkAccount(...a),
  listMySessions: (...a: unknown[]) => listMySessions(...a),
  revokeMySession: (...a: unknown[]) => revokeMySession(...a),
  revokeOtherMySessions: (...a: unknown[]) => revokeOtherMySessions(...a),
  signOutEverywhere: (...a: unknown[]) => signOutEverywhere(...a),
  deleteAccount: (...a: unknown[]) => deleteAccount(...a),
}));

const requestEmailChange = vi.fn();
const requestEmailVerification = vi.fn();
vi.mock("@/server/email-verification/actions", () => ({
  requestEmailChange: (...a: unknown[]) => requestEmailChange(...a),
  requestEmailVerification: (...a: unknown[]) => requestEmailVerification(...a),
}));

const startTwoFactorSetup = vi.fn();
const confirmTwoFactorSetup = vi.fn();
const regenerateRecoveryCodes = vi.fn();
const disableTwoFactor = vi.fn();
vi.mock("@/server/two-factor/actions", () => ({
  startTwoFactorSetup: (...a: unknown[]) => startTwoFactorSetup(...a),
  confirmTwoFactorSetup: (...a: unknown[]) => confirmTwoFactorSetup(...a),
  regenerateRecoveryCodes: (...a: unknown[]) => regenerateRecoveryCodes(...a),
  disableTwoFactor: (...a: unknown[]) => disableTwoFactor(...a),
}));

stubLayoutBox({ width: 1440 });

const OK = { success: true };

/** The worked examples' authErrors copy, in Spanish. */
const FORM_ALERTS = {
  rateLimited: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  generic: "Algo ha ido mal. Inténtalo de nuevo.",
  conflict:
    "Estos datos han cambiado en otra pestaña o dispositivo. Recarga la página para ver la versión actual.",
} as const;

/** jsdom's own navigator, put back after every test. */
const REAL_NAVIGATOR = navigator;

/** The browser's clipboard, stubbed for one test and restored after it. */
function stubClipboard(writeText: (text: string) => Promise<void>) {
  const clipboard = { writeText };
  vi.stubGlobal(
    "navigator",
    new Proxy(REAL_NAVIGATOR, {
      get: (target, property) =>
        property === "clipboard" ? clipboard : Reflect.get(target, property, target),
    }),
  );
}

/** Whether `first` comes before `second` in the document. */
function precedes(first: Element, second: Element) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-16T12:00:00.000Z") });
  for (const fn of [
    updateProfile,
    changePassword,
    unlinkAccount,
    listMySessions,
    revokeMySession,
    revokeOtherMySessions,
    signOutEverywhere,
    deleteAccount,
    requestEmailChange,
    requestEmailVerification,
    startTwoFactorSetup,
    confirmTwoFactorSetup,
    regenerateRecoveryCodes,
    disableTwoFactor,
    signOut,
    signInEmail,
    notify,
    push,
    refresh,
    captureException,
  ]) {
    fn.mockReset();
  }
  listMySessions.mockResolvedValue([]);
  signInEmail.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  vi.useRealTimers();
  vi.stubGlobal("navigator", REAL_NAVIGATOR);
  vi.restoreAllMocks();
});

describe("PAGES-25: /account at desktop width", () => {
  it("PAGES-25: shows «Cuenta» (h1, in capitals), the line, «Cerrar sesión» on the heading's row, and the cards in order, with no «Volver al mapa» link", () => {
    renderAccount();

    const heading = screen.getByRole("heading", { level: 1, name: ACCOUNT_COPY.heading });
    expect(heading).toHaveClass("uppercase");
    expect(screen.getByText(ACCOUNT_COPY.descriptionDesktop)).toBeInTheDocument();
    const regions = within(screen.getByRole("main"))
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-label"));
    expect(regions).toEqual([
      null, // the user's own card names no title the same way as the rest (PAGES-29)
      "Correo",
      "Contraseña",
      "Dos pasos",
      "Google",
      "Sesiones",
      "Tus datos",
      "Eliminar cuenta",
    ]);
    expect(screen.queryByRole("link", { name: "Volver al mapa" })).not.toBeInTheDocument();
    // Breakpoints place «Cerrar sesión» (jsdom draws no CSS): on the heading's
    // row from `lg`, after the last card below it.
    const header = heading.closest("header");
    if (!header) throw new Error("expected the heading's row");
    const inHeader = within(header).getByRole("button", { name: ACCOUNT_COPY.signOut });
    expect(inHeader).toHaveClass("hidden", "lg:inline-flex");
    const all = screen.getAllByRole("button", { name: ACCOUNT_COPY.signOut });
    expect(all).toHaveLength(2);
    expect(all.find((button) => button !== inHeader)).toHaveClass("lg:hidden");
    expect(screen.getByText(ACCOUNT_COPY.descriptionDesktop)).toHaveClass("hidden", "lg:block");
  });
});

describe("PAGES-27: a Google-only account (no password)", () => {
  it("PAGES-27: has no «Contraseña» card and no «Dos pasos» card, and «Correo» has no button", () => {
    renderAccount(googleOnlyAccount());

    expect(screen.queryByRole("region", { name: "Contraseña" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Dos pasos" })).not.toBeInTheDocument();
    expect(withinCard("Correo").queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("PAGES-29: the user's own card", () => {
  it("PAGES-29: shows the avatar's initial, the name as its heading, the email, the summary line and «Cambiar nombre»", () => {
    renderAccount(albaAccount());

    expect(screen.getByRole("heading", { name: "Alba" })).toBeInTheDocument();
    expect(withinCard("Alba").getByText("alba@example.com")).toBeInTheDocument();
    expect(
      screen.getByText("8 guardados · 3 alertas · en BuyCarMap desde marzo"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ACCOUNT_COPY.changeName })).toBeInTheDocument();
  });

  it("PAGES-29: with no name, the email is the card's heading", () => {
    renderAccount(albaAccount({ name: null }));

    expect(screen.getByRole("heading", { name: "alba@example.com" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Alba" })).not.toBeInTheDocument();
  });
});

describe("PAGES-31: the summary line (worked example, rendered through the own card)", () => {
  it.each(
    SUMMARY_LINE_CASES.map(
      ({ saved, alerts, createdAt, timeZone, line }) =>
        [saved, alerts, createdAt, timeZone, line] as const,
    ),
  )(
    "PAGES-31: %s saved, %s alerts, created %s reads «%s»",
    (favoritesCount, alertsCount, createdAt, timeZone, line) => {
      renderAccount(albaAccount({ favoritesCount, alertsCount, createdAt: new Date(createdAt) }), {
        timeZone,
      });

      expect(screen.getByText(line)).toBeInTheDocument();
    },
  );
});

describe("PAGES-30: the «Correo» card", () => {
  it("PAGES-30: confirmed shows «Verificado» and «Cambiar correo»", () => {
    renderAccount(albaAccount({ emailConfirmed: true }));
    const emailCard = withinCard("Correo");

    expect(emailCard.getByText(ACCOUNT_COPY.verified)).toBeInTheDocument();
    expect(
      emailCard.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent === "alba@example.com. Con él entras y te llegan las alertas.",
      ),
    ).toBeInTheDocument();
    expect(emailCard.getByRole("button", { name: ACCOUNT_COPY.changeEmail })).toBeInTheDocument();
  });

  it("PAGES-30: unverified shows «Sin verificar», «Enviar correo de verificación» and «Cambiar correo» as a text button", () => {
    renderAccount(albaAccount({ emailConfirmed: false }));
    const emailCard = withinCard("Correo");

    expect(emailCard.getByText(ACCOUNT_COPY.unverified)).toBeInTheDocument();
    expect(
      emailCard.getByRole("button", { name: ACCOUNT_COPY.sendVerification }),
    ).toBeInTheDocument();
    expect(emailCard.getByRole("button", { name: ACCOUNT_COPY.changeEmail })).toBeInTheDocument();
  });

  it("PAGES-30: a Google-only account reads «alba@example.com. Tu dirección de correo no se puede cambiar.» with no button and no actions row", () => {
    renderAccount(googleOnlyAccount());
    const emailCard = withinCard("Correo");
    const region = screen.getByRole("region", { name: "Correo" });

    const line = region.querySelector("p");
    expect(line).toHaveTextContent(
      /^alba@example\.com\. Tu dirección de correo no se puede cambiar\.$/,
    );
    expect(emailCard.queryByRole("button")).not.toBeInTheDocument();
    // The card ends on its line: the title row and the line, no empty actions row.
    expect(region.children).toHaveLength(2);
    expect(region.lastElementChild).toBe(line);
  });
});

describe("PAGES-32: the «Contraseña» card", () => {
  it("PAGES-32: shows «La que usas para entrar con tu correo.», «Cambiar contraseña» and no date", () => {
    renderAccount();
    const passwordCard = withinCard("Contraseña");

    expect(passwordCard.getByText("La que usas para entrar con tu correo.")).toBeInTheDocument();
    expect(
      passwordCard.getByRole("button", { name: ACCOUNT_COPY.changePassword }),
    ).toBeInTheDocument();
    expect(passwordCard.queryByText(/\d{4}/)).not.toBeInTheDocument();
  });
});

describe("PAGES-33: the «Dos pasos» card", () => {
  it("PAGES-33: off shows the outlined «Desactivada» badge and «Activar»", () => {
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const twoFactorCard = withinCard("Dos pasos");

    expect(twoFactorCard.getByText(ACCOUNT_COPY.twoFactorOff)).toBeInTheDocument();
    expect(twoFactorCard.getByRole("button", { name: ACCOUNT_COPY.activate })).toBeInTheDocument();
  });

  it("PAGES-33: on shows the «Activada» badge and «Gestionar»", () => {
    renderAccount(albaAccount({ twoFactorEnabled: true }));
    const twoFactorCard = withinCard("Dos pasos");

    expect(twoFactorCard.getByText(ACCOUNT_COPY.twoFactorOn)).toBeInTheDocument();
    expect(twoFactorCard.getByRole("button", { name: ACCOUNT_COPY.manage })).toBeInTheDocument();
  });
});

describe("PAGES-34: the «Google» card", () => {
  it("PAGES-34: linked shows «Conectada», the line and «Desconectar»", () => {
    renderAccount(albaAccount({ providers: ["google"] }));
    const googleCard = withinCard("Google");

    expect(googleCard.getByText(ACCOUNT_COPY.connected)).toBeInTheDocument();
    expect(googleCard.getByText("También puedes entrar con Google.")).toBeInTheDocument();
    expect(googleCard.getByRole("button", { name: ACCOUNT_COPY.disconnect })).toBeInTheDocument();
  });

  it("PAGES-34: with nothing linked shows no badge, «No hay cuentas conectadas.» and no button", () => {
    renderAccount(albaAccount({ providers: [] }));
    const googleCard = withinCard("Google");

    expect(googleCard.getByText("No hay cuentas conectadas.")).toBeInTheDocument();
    expect(googleCard.queryByRole("button")).not.toBeInTheDocument();
  });

  it("PAGES-34: Google as the only sign-in method disables «Desconectar» and drops the set-a-password instruction", () => {
    renderAccount(googleOnlyAccount());
    const googleCard = withinCard("Google");

    expect(googleCard.getByText(ACCOUNT_COPY.lastSignInMethodLine)).toBeInTheDocument();
    expect(googleCard.getByRole("button", { name: ACCOUNT_COPY.disconnect })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(googleCard.queryByText(/contraseña antes de desconectarla/)).not.toBeInTheDocument();
  });

  it("PAGES-34: never lists the credential row or GitHub", () => {
    renderAccount(albaAccount({ providers: ["google", "credential", "github"] }));
    const googleCard = withinCard("Google");

    expect(googleCard.queryByText(/github/i)).not.toBeInTheDocument();
    expect(googleCard.getAllByRole("button", { name: ACCOUNT_COPY.disconnect })).toHaveLength(1);
  });
});

describe("PAGES-35: the «Sesiones» card (worked example «Sessions line»)", () => {
  it("PAGES-35: one session reads «1 abierta» and «Chrome en Windows, esta.»", () => {
    renderAccount(albaAccount());
    const sessionsCard = withinCard("Sesiones");

    expect(sessionsCard.getByText("1 abierta")).toBeInTheDocument();
    expect(sessionsCard.getByText("Chrome en Windows, esta.")).toBeInTheDocument();
    expect(
      sessionsCard.getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
    ).toBeInTheDocument();
  });

  it("PAGES-35: two sessions read «2 abiertas» and name both, newest first", () => {
    renderAccount(albaWithTwoSessions());
    const sessionsCard = withinCard("Sesiones");

    expect(sessionsCard.getByText("2 abiertas")).toBeInTheDocument();
    expect(
      sessionsCard.getByText("Chrome en Windows, esta. Safari en iOS, hace 2 días."),
    ).toBeInTheDocument();
  });

  it("PAGES-35: three sessions read «3 abiertas» and «…, y 1 más.»", () => {
    const [thisDevice, iphone] = albaWithTwoSessions().sessions;
    renderAccount(
      albaAccount({
        sessions: [
          thisDevice,
          iphone,
          {
            id: "session-old",
            userAgent: "",
            lastUsedAt: new Date("2026-10-01T12:00:00.000Z"),
            current: false,
          },
        ],
      }),
    );
    const sessionsCard = withinCard("Sesiones");

    expect(sessionsCard.getByText("3 abiertas")).toBeInTheDocument();
    expect(
      sessionsCard.getByText("Chrome en Windows, esta. Safari en iOS, hace 2 días, y 1 más."),
    ).toBeInTheDocument();
  });

  it("PAGES-35: this device used less recently than another is named second", () => {
    const [thisDevice, iphone] = albaWithTwoSessions().sessions;
    renderAccount(
      albaAccount({
        sessions: [
          { ...iphone, lastUsedAt: new Date("2026-10-14T12:00:00.000Z") },
          { ...thisDevice, lastUsedAt: new Date("2026-10-13T12:00:00.000Z") },
        ],
      }),
    );
    const sessionsCard = withinCard("Sesiones");

    expect(sessionsCard.getByText("2 abiertas")).toBeInTheDocument();
    expect(
      sessionsCard.getByText("Safari en iOS, hace 2 días. Chrome en Windows, esta."),
    ).toBeInTheDocument();
  });

  it("PAGES-35: five sessions read «5 abiertas» and «… y 3 más»", () => {
    renderAccount(albaWithFiveSessions());
    const sessionsCard = withinCard("Sesiones");

    expect(sessionsCard.getByText("5 abiertas")).toBeInTheDocument();
    expect(
      sessionsCard.getByText("Chrome en Windows, esta. Safari en iOS, hace 2 días, y 3 más."),
    ).toBeInTheDocument();
  });
});

describe("PAGES-36: the «Tus datos» card", () => {
  it("PAGES-36: shows its line and «Descargar mis datos»", () => {
    renderAccount();
    const dataCard = withinCard("Tus datos");

    expect(
      dataCard.getByText(
        "Tu perfil, tus sesiones, tus coches guardados y tus alertas, en un archivo JSON.",
      ),
    ).toBeInTheDocument();
    expect(dataCard.getByRole("button", { name: ACCOUNT_COPY.downloadData })).toBeInTheDocument();
  });
});

describe("PAGES-37: the «Eliminar cuenta» card", () => {
  it("PAGES-37: shows its title, «Eliminar mi cuenta» in danger and the warning line", () => {
    renderAccount();
    const deleteCard = withinCard("Eliminar cuenta");

    expect(deleteCard.getByText(ACCOUNT_COPY.deleteWarning)).toBeInTheDocument();
    const deleteButton = deleteCard.getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta });
    expect(deleteButton).toHaveAttribute("data-variant", "danger");
    expect(deleteCard.getByRole("heading", { name: "Eliminar cuenta" })).toHaveClass("text-danger");
  });
});

async function openDialog(cardTitle: string, buttonName: string, dialogTitle: string) {
  const opener = withinCard(cardTitle).getByRole("button", { name: buttonName });
  await userEvent.click(opener);
  const dialog = await screen.findByRole("dialog", { name: dialogTitle });
  return { opener, dialog };
}

describe("PAGES-38: dialogs open centred over the dimmed page, close with «Cancelar», Escape or outside, and return focus", () => {
  it("PAGES-38: «Cambiar nombre» opens a dialog named by its title, with no «×»", async () => {
    renderAccount();

    const { dialog } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

    // Its buttons are exactly the submit and «Cancelar»: no «×».
    expect(
      within(dialog)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([ACCOUNT_COPY.saveChanges, ACCOUNT_COPY.cancel]);
  });

  it("PAGES-38: «Cancelar» closes it with nothing sent and returns focus to the opener", async () => {
    renderAccount();
    const { opener, dialog } = await openDialog(
      "Alba",
      ACCOUNT_COPY.changeName,
      ACCOUNT_COPY.changeName,
    );

    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.cancel }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("PAGES-38: Escape closes it with nothing sent and returns focus to the opener", async () => {
    renderAccount();
    const { opener } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("PAGES-38: a press outside closes it with nothing sent and returns focus to the opener", async () => {
    renderAccount();
    const { opener } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
});

describe("PAGES-40: «Cambiar nombre»", () => {
  it("PAGES-40: holds the current name and «Guardar cambios» is enabled from the start", async () => {
    renderAccount(albaAccount({ name: "Alba" }));
    const { dialog } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Alba");
    expect(within(dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges })).toBeEnabled();
  });

  it("PAGES-40: saving calls updateProfile with the name and the rendered version once; on success it closes, toasts, and updates the heading and header avatar", async () => {
    updateProfile.mockResolvedValue(OK);
    renderAccount(albaAccount({ name: "Alba", version: 7 }));
    const { dialog } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

    await userEvent.clear(within(dialog).getByLabelText("Nombre"));
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Alba García");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    const submitted = updateProfile.mock.calls[0][0] as FormData;
    expect(submitted.get("name")).toBe("Alba García");
    expect(submitted.get("version")).toBe("7");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText(ACCOUNT_COPY.profileUpdated)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alba García" })).toBeInTheDocument();
    // The header's avatar reads the session again, so it takes the new name.
    expect(notify).toHaveBeenCalledWith("$sessionSignal");
  });

  it("PAGES-40: saving the same name closes the dialog with no request and no toast", async () => {
    renderAccount(albaAccount({ name: "Alba" }));
    const { dialog } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(updateProfile).not.toHaveBeenCalled();
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });

  it("PAGES-40: a conflict is a form alert in the dialog, not a toast (amends DATA-16)", async () => {
    updateProfile.mockResolvedValue({ success: false, error: "conflict" });
    renderAccount(albaAccount({ name: "Alba" }));
    const { dialog } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

    await userEvent.type(within(dialog).getByLabelText("Nombre"), " García");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(FORM_ALERTS.conflict);
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
    expect(screen.getByRole("dialog", { name: ACCOUNT_COPY.changeName })).toBeInTheDocument();
  });
});

describe("PAGES-41: «Cambiar correo»", () => {
  it("PAGES-41: shows the notice, both fields and the two buttons", async () => {
    renderAccount();
    const { dialog } = await openDialog(
      "Correo",
      ACCOUNT_COPY.changeEmail,
      ACCOUNT_COPY.changeEmail,
    );

    expect(within(dialog).getByText(ACCOUNT_COPY.emailChangeNotice)).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Nueva dirección de correo")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Contraseña actual")).toBeInTheDocument();
  });

  it("PAGES-41: currentPasswordIncorrect is a field error under «Contraseña actual»", async () => {
    requestEmailChange.mockResolvedValue({ success: false, error: "currentPasswordIncorrect" });
    renderAccount();
    const { dialog } = await openDialog(
      "Correo",
      ACCOUNT_COPY.changeEmail,
      ACCOUNT_COPY.changeEmail,
    );

    await userEvent.type(
      within(dialog).getByLabelText("Nueva dirección de correo"),
      "new@example.com",
    );
    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "wrong");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.changeEmail }));

    expect(
      await within(dialog).findByText(ACCOUNT_COPY.currentPasswordIncorrect),
    ).toBeInTheDocument();
  });

  it("PAGES-41: sameEmail is a field error under the address field", async () => {
    requestEmailChange.mockResolvedValue({ success: false, error: "sameEmail" });
    renderAccount(albaAccount({ email: "alba@example.com" }));
    const { dialog } = await openDialog(
      "Correo",
      ACCOUNT_COPY.changeEmail,
      ACCOUNT_COPY.changeEmail,
    );

    await userEvent.type(
      within(dialog).getByLabelText("Nueva dirección de correo"),
      "alba@example.com",
    );
    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "secret-pw");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.changeEmail }));

    expect(await within(dialog).findByText(ACCOUNT_COPY.sameEmail)).toBeInTheDocument();
  });

  it("PAGES-41: on success the form gives way to the neutral notice and «Cerrar», and the card's email does not change", async () => {
    requestEmailChange.mockResolvedValue(OK);
    renderAccount(albaAccount({ email: "alba@example.com" }));
    const { dialog } = await openDialog(
      "Correo",
      ACCOUNT_COPY.changeEmail,
      ACCOUNT_COPY.changeEmail,
    );

    await userEvent.type(
      within(dialog).getByLabelText("Nueva dirección de correo"),
      "new@example.com",
    );
    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "secret-pw");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.changeEmail }));

    expect(await within(dialog).findByText(ACCOUNT_COPY.emailChangeSent)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: ACCOUNT_COPY.close })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(withinCard("Correo").getByText(/alba@example\.com/)).toBeInTheDocument();
  });
});

describe("PAGES-42: «Cambiar contraseña»", () => {
  it("PAGES-42: shows the three password fields, the sessions note and «Guardar contraseña»", async () => {
    renderAccount();
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );

    expect(within(dialog).getByLabelText("Contraseña actual")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Nueva contraseña")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Repite la contraseña")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/cerrará la sesión en el resto de dispositivos/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword }),
    ).toBeInTheDocument();
  });

  it.each([
    ["passwordBreached", ACCOUNT_COPY.passwordBreached],
    ["passwordWeak", ACCOUNT_COPY.passwordWeak],
    ["passwordReused", ACCOUNT_COPY.passwordReused],
  ] as const)(
    "PAGES-42 / worked example «Server rejections»: %s is a field error under «Nueva contraseña»",
    async (code, message) => {
      changePassword.mockResolvedValue({ success: false, error: code });
      renderAccount();
      const { dialog } = await openDialog(
        "Contraseña",
        ACCOUNT_COPY.changePassword,
        ACCOUNT_COPY.changePassword,
      );

      await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "current-pw");
      await userEvent.type(within(dialog).getByLabelText("Nueva contraseña"), "new-password-1");
      await userEvent.type(within(dialog).getByLabelText("Repite la contraseña"), "new-password-1");
      await userEvent.click(
        within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword }),
      );

      const error = await within(dialog).findByText(message);
      // Under «Nueva contraseña», before the meter.
      expect(within(dialog).getByLabelText("Nueva contraseña")).toHaveAccessibleDescription(
        message,
      );
      expect(precedes(error, within(dialog).getByText("Seguridad:", { exact: false }))).toBe(true);
    },
  );

  it("PAGES-42: currentPasswordIncorrect is a field error under «Contraseña actual»", async () => {
    changePassword.mockResolvedValue({ success: false, error: "currentPasswordIncorrect" });
    renderAccount();
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );

    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "wrong");
    await userEvent.type(within(dialog).getByLabelText("Nueva contraseña"), "new-password-1");
    await userEvent.type(within(dialog).getByLabelText("Repite la contraseña"), "new-password-1");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword }));

    expect(
      await within(dialog).findByText(ACCOUNT_COPY.currentPasswordIncorrect),
    ).toBeInTheDocument();
  });

  it("PAGES-42: on success the dialog closes and toasts «Contraseña actualizada»", async () => {
    changePassword.mockResolvedValue(OK);
    renderAccount();
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );

    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "current-pw");
    await userEvent.type(within(dialog).getByLabelText("Nueva contraseña"), "new-password-1");
    await userEvent.type(within(dialog).getByLabelText("Repite la contraseña"), "new-password-1");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText(ACCOUNT_COPY.passwordUpdated)).toBeInTheDocument();
  });
});

describe("PAGES-43: «Enviar correo de verificación»", () => {
  it("PAGES-43: calls requestEmailVerification once, busy while it runs, then toasts success", async () => {
    let resolveCall: (value: { success: true }) => void = () => undefined;
    requestEmailVerification.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );
    renderAccount(albaAccount({ emailConfirmed: false }));

    const button = withinCard("Correo").getByRole("button", {
      name: ACCOUNT_COPY.sendVerification,
    });
    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    resolveCall({ success: true });
    await waitFor(() =>
      expect(screen.getByText(ACCOUNT_COPY.verificationSent)).toBeInTheDocument(),
    );
    expect(requestEmailVerification).toHaveBeenCalledTimes(1);
  });

  it("PAGES-43: a refusal (rateLimited, alreadyVerified) is the error toast with its copy", async () => {
    requestEmailVerification.mockResolvedValue({ success: false, error: "alreadyVerified" });
    renderAccount(albaAccount({ emailConfirmed: false }));

    await userEvent.click(
      withinCard("Correo").getByRole("button", { name: ACCOUNT_COPY.sendVerification }),
    );

    await waitFor(() =>
      expect(document.querySelector("[data-sonner-toast]")).toHaveTextContent(
        "Tu dirección de correo ya está verificada",
      ),
    );
  });
});

describe("PAGES-71: a failure with no field is a form alert, never a toast — any account dialog", () => {
  it.each(["rateLimited", "generic"] as const)(
    "PAGES-71: %s on «Cambiar nombre» is a form alert above the primary button",
    async (code) => {
      updateProfile.mockResolvedValue({ success: false, error: code });
      renderAccount(albaAccount({ name: "Alba" }));
      const { dialog } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

      await userEvent.type(within(dialog).getByLabelText("Nombre"), " García");
      await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }));

      const alert = await within(dialog).findByRole("alert");
      expect(alert).toHaveTextContent(FORM_ALERTS[code]);
      expect(
        precedes(alert, within(dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges })),
      ).toBe(true);
      expect(document.querySelector("[data-sonner-toast]")).toBeNull();
      expect(screen.getByRole("dialog", { name: ACCOUNT_COPY.changeName })).toBeInTheDocument();
    },
  );
});

describe("PAGES-72: while a dialog's request runs, it cannot be closed", () => {
  it("PAGES-72: Escape, outside and «Cancelar» do nothing while updateProfile is pending", async () => {
    updateProfile.mockReturnValue(
      new Promise(() => {
        // Intentionally left pending.
      }),
    );
    renderAccount(albaAccount({ name: "Alba" }));
    const { dialog } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);
    await userEvent.type(within(dialog).getByLabelText("Nombre"), " García");

    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }));
    await userEvent.keyboard("{Escape}");
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.cancel }));

    expect(screen.getByRole("dialog", { name: ACCOUNT_COPY.changeName })).toBe(dialog);
    expect(updateProfile).toHaveBeenCalledTimes(1);
  });
});

describe("PAGES-73: focus starts on the first field, or the dialog's own first control", () => {
  it("PAGES-73: «Cambiar nombre» opens with focus on «Nombre»", async () => {
    renderAccount(albaAccount({ name: "Alba" }));
    const { dialog } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

    await waitFor(() => expect(within(dialog).getByLabelText("Nombre")).toHaveFocus());
  });

  it("PAGES-73: «Sesiones» opens with focus on «Cerrar»", async () => {
    renderAccount();
    const { dialog } = await openDialog("Sesiones", ACCOUNT_COPY.closeOthers, "Sesiones");

    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: ACCOUNT_COPY.close })).toHaveFocus(),
    );
  });
});

describe("PAGES-44: activating two-factor", () => {
  it("PAGES-44: «Activar» opens «Dos pasos» asking for the password first", async () => {
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");

    expect(within(dialog).getByLabelText("Tu contraseña")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor }),
    ).toBeInTheDocument();
  });

  it("PAGES-44: with the password accepted, shows the QR, the manual key and the code field", async () => {
    startTwoFactorSetup.mockResolvedValue({
      success: true,
      otpauthUri: "otpauth://totp/BuyCarMap:alba@example.com?secret=ABCDEF",
      secret: "ABCDEF",
      recoveryCodes: Array.from({ length: 10 }, (_, i) => `code-${i}`),
    });
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");
    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor }),
    );

    expect(await within(dialog).findByDisplayValue("ABCDEF")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.activateTwoFactor }),
    ).toBeInTheDocument();
  });

  it("PAGES-44: a wrong code is a field error under the code field", async () => {
    startTwoFactorSetup.mockResolvedValue({
      success: true,
      otpauthUri: "otpauth://totp/x?secret=ABCDEF",
      secret: "ABCDEF",
      recoveryCodes: Array.from({ length: 10 }, (_, i) => `code-${i}`),
    });
    confirmTwoFactorSetup.mockResolvedValue({ success: false, error: "totpInvalid" });
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");
    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor }),
    );
    await within(dialog).findByDisplayValue("ABCDEF");

    await userEvent.type(
      within(dialog).getByLabelText("Introduce el código de 6 dígitos"),
      "000000",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.activateTwoFactor }),
    );

    expect(await within(dialog).findByText(ACCOUNT_COPY.totpInvalid)).toBeInTheDocument();
  });

  it("PAGES-44: a wrong password is a field error under «Tu contraseña», with no toast", async () => {
    startTwoFactorSetup.mockResolvedValue({ success: false, error: "currentPasswordIncorrect" });
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");

    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "wrong");
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor }),
    );

    expect(
      await within(dialog).findByText(ACCOUNT_COPY.currentPasswordIncorrect),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Tu contraseña")).toHaveAccessibleDescription(
      ACCOUNT_COPY.currentPasswordIncorrect,
    );
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });
});

describe("PAGES-45: the recovery codes", () => {
  async function openCodesAfterSetup() {
    startTwoFactorSetup.mockResolvedValue({
      success: true,
      otpauthUri: "otpauth://totp/x?secret=ABCDEF",
      secret: "ABCDEF",
      recoveryCodes: Array.from({ length: 10 }, (_, i) => `code-${i}`),
    });
    confirmTwoFactorSetup.mockResolvedValue(OK);
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog: setup } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");
    await userEvent.type(within(setup).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.click(
      within(setup).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor }),
    );
    await within(setup).findByDisplayValue("ABCDEF");
    await userEvent.type(
      within(setup).getByLabelText("Introduce el código de 6 dígitos"),
      "123456",
    );
    await userEvent.click(
      within(setup).getByRole("button", { name: ACCOUNT_COPY.activateTwoFactor }),
    );
    return screen.findByRole("alertdialog", { name: "Guarda tus códigos de recuperación" });
  }

  it("PAGES-45: shows the ten codes once, with «Copiar códigos» and «Ya los he guardado» disabled until copied, and no «Cancelar»", async () => {
    const codes = await openCodesAfterSetup();

    expect(within(codes).getByText("code-0")).toBeInTheDocument();
    expect(within(codes).getByText("code-9")).toBeInTheDocument();
    expect(within(codes).getByRole("button", { name: ACCOUNT_COPY.codesSaved })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(codes).queryByRole("button", { name: ACCOUNT_COPY.cancel })).toBeNull();
  });

  it("PAGES-45: Escape and a press outside do not close it", async () => {
    const codes = await openCodesAfterSetup();

    await userEvent.keyboard("{Escape}");
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);

    expect(screen.getByRole("alertdialog", { name: "Guarda tus códigos de recuperación" })).toBe(
      codes,
    );
  });

  it("PAGES-45: «Ya los he guardado» becomes enabled after the first «Copiar códigos» press, even if the copy fails", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    const codes = await openCodesAfterSetup();

    await userEvent.click(within(codes).getByRole("button", { name: ACCOUNT_COPY.copyCodes }));

    await waitFor(() =>
      expect(
        within(codes).getByRole("button", { name: ACCOUNT_COPY.codesSaved }),
      ).not.toHaveAttribute("aria-disabled", "true"),
    );
    expect(within(codes).getByText("code-0")).toBeInTheDocument();
  });
});

describe("PAGES-46: «Copiar códigos»", () => {
  it("PAGES-46: writes the ten codes one per line and toasts success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    startTwoFactorSetup.mockResolvedValue({
      success: true,
      otpauthUri: "otpauth://totp/x?secret=ABCDEF",
      secret: "ABCDEF",
      recoveryCodes: Array.from({ length: 10 }, (_, i) => `code-${i}`),
    });
    confirmTwoFactorSetup.mockResolvedValue(OK);
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog: setup } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");
    await userEvent.type(within(setup).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.click(
      within(setup).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor }),
    );
    await within(setup).findByDisplayValue("ABCDEF");
    await userEvent.type(
      within(setup).getByLabelText("Introduce el código de 6 dígitos"),
      "123456",
    );
    await userEvent.click(
      within(setup).getByRole("button", { name: ACCOUNT_COPY.activateTwoFactor }),
    );
    const codes = await screen.findByRole("alertdialog", {
      name: "Guarda tus códigos de recuperación",
    });

    await userEvent.click(within(codes).getByRole("button", { name: ACCOUNT_COPY.copyCodes }));

    expect(writeText).toHaveBeenCalledWith(
      Array.from({ length: 10 }, (_, i) => `code-${i}`).join("\n"),
    );
    expect(await screen.findByText(ACCOUNT_COPY.codesCopied)).toBeInTheDocument();
  });

  it("PAGES-46: a browser refusal shows the manual-copy error toast", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    startTwoFactorSetup.mockResolvedValue({
      success: true,
      otpauthUri: "otpauth://totp/x?secret=ABCDEF",
      secret: "ABCDEF",
      recoveryCodes: Array.from({ length: 10 }, (_, i) => `code-${i}`),
    });
    confirmTwoFactorSetup.mockResolvedValue(OK);
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog: setup } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");
    await userEvent.type(within(setup).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.click(
      within(setup).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor }),
    );
    await within(setup).findByDisplayValue("ABCDEF");
    await userEvent.type(
      within(setup).getByLabelText("Introduce el código de 6 dígitos"),
      "123456",
    );
    await userEvent.click(
      within(setup).getByRole("button", { name: ACCOUNT_COPY.activateTwoFactor }),
    );
    const codes = await screen.findByRole("alertdialog", {
      name: "Guarda tus códigos de recuperación",
    });

    await userEvent.click(within(codes).getByRole("button", { name: ACCOUNT_COPY.copyCodes }));

    expect(await screen.findByText(ACCOUNT_COPY.copyFailed)).toBeInTheDocument();
  });
});

describe("PAGES-47: closing the codes after enabling", () => {
  it("PAGES-47: toasts «Verificación en dos pasos activada» and the card then shows «Activada»/«Gestionar»", async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    startTwoFactorSetup.mockResolvedValue({
      success: true,
      otpauthUri: "otpauth://totp/x?secret=ABCDEF",
      secret: "ABCDEF",
      recoveryCodes: Array.from({ length: 10 }, (_, i) => `code-${i}`),
    });
    confirmTwoFactorSetup.mockResolvedValue(OK);
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog: setup } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");
    await userEvent.type(within(setup).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.click(
      within(setup).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor }),
    );
    await within(setup).findByDisplayValue("ABCDEF");
    await userEvent.type(
      within(setup).getByLabelText("Introduce el código de 6 dígitos"),
      "123456",
    );
    await userEvent.click(
      within(setup).getByRole("button", { name: ACCOUNT_COPY.activateTwoFactor }),
    );
    const codes = await screen.findByRole("alertdialog", {
      name: "Guarda tus códigos de recuperación",
    });
    await userEvent.click(within(codes).getByRole("button", { name: ACCOUNT_COPY.copyCodes }));

    await userEvent.click(within(codes).getByRole("button", { name: ACCOUNT_COPY.codesSaved }));

    expect(await screen.findByText(ACCOUNT_COPY.twoFactorEnabledToast)).toBeInTheDocument();
    const twoFactorCard = withinCard("Dos pasos");
    expect(twoFactorCard.getByText(ACCOUNT_COPY.twoFactorOn)).toBeInTheDocument();
    expect(twoFactorCard.getByRole("button", { name: ACCOUNT_COPY.manage })).toBeInTheDocument();
  });
});

describe("PAGES-48: «Gestionar»", () => {
  it("PAGES-48: opens with the password field, «Generar códigos nuevos», the code field and «Desactivar dos pasos»", async () => {
    renderAccount(albaAccount({ twoFactorEnabled: true }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.manage, "Dos pasos");

    expect(within(dialog).getByLabelText("Tu contraseña")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.regenerateCodes }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Introduce el código de 6 dígitos")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.disableTwoFactor }),
    ).toBeInTheDocument();
  });

  it("PAGES-48: a wrong password on «Generar códigos nuevos» is a field error under «Tu contraseña»", async () => {
    regenerateRecoveryCodes.mockResolvedValue({
      success: false,
      error: "currentPasswordIncorrect",
    });
    renderAccount(albaAccount({ twoFactorEnabled: true }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.manage, "Dos pasos");

    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "wrong");
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.regenerateCodes }),
    );

    expect(
      await within(dialog).findByText(ACCOUNT_COPY.currentPasswordIncorrect),
    ).toBeInTheDocument();
  });

  it("PAGES-48: a disable that succeeds closes the dialog, toasts, and the card shows «Desactivada»/«Activar»", async () => {
    disableTwoFactor.mockResolvedValue(OK);
    renderAccount(albaAccount({ twoFactorEnabled: true }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.manage, "Dos pasos");

    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.type(
      within(dialog).getByLabelText("Introduce el código de 6 dígitos"),
      "123456",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.disableTwoFactor }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText(ACCOUNT_COPY.twoFactorDisabledToast)).toBeInTheDocument();
    const twoFactorCard = withinCard("Dos pasos");
    expect(twoFactorCard.getByText(ACCOUNT_COPY.twoFactorOff)).toBeInTheDocument();
    expect(twoFactorCard.getByRole("button", { name: ACCOUNT_COPY.activate })).toBeInTheDocument();
  });
});

describe("PAGES-49, PAGES-50: the «Sesiones» dialog", () => {
  it("PAGES-49: reads the sessions again with listMySessions each time it opens", async () => {
    listMySessions.mockResolvedValue([
      { id: "a", userAgent: "Chrome", lastUsedAt: new Date(), current: true },
    ]);
    renderAccount();

    const opener = withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers });
    await userEvent.click(opener);
    await waitFor(() => expect(listMySessions).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: ACCOUNT_COPY.close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(opener);
    await waitFor(() => expect(listMySessions).toHaveBeenCalledTimes(2));
  });

  it("PAGES-50: shows placeholder rows while loading, then «Reintentar» when the read fails, never a toast", async () => {
    listMySessions.mockRejectedValue(new Error("network down"));
    renderAccount();

    await userEvent.click(
      withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
    );

    expect(await screen.findByText(ACCOUNT_COPY.sessionsLoadError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ACCOUNT_COPY.retry })).toBeInTheDocument();
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });
});

describe("PAGES-51: closing sessions", () => {
  it("PAGES-51: «Cerrar las demás» leaves this device alone and toasts success", async () => {
    revokeOtherMySessions.mockResolvedValue(OK);
    listMySessions.mockResolvedValue([
      { id: "a", userAgent: "Chrome/120 Windows", lastUsedAt: new Date(), current: true },
    ]);
    renderAccount();
    await userEvent.click(
      withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Sesiones" });
    await within(dialog).findByText("Chrome en Windows");

    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.closeOthers }));

    expect(await screen.findByText(ACCOUNT_COPY.othersSignedOutToast)).toBeInTheDocument();
    expect(revokeOtherMySessions).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(listMySessions).toHaveBeenCalledTimes(2));
    expect(within(dialog).getByText("Chrome en Windows")).toBeInTheDocument();
    expect(within(dialog).getByText("Este dispositivo")).toBeInTheDocument();
  });

  it("PAGES-51: «Cerrar sesión en todas partes» ends every session and sends the user to /", async () => {
    signOutEverywhere.mockResolvedValue(OK);
    listMySessions.mockResolvedValue([
      { id: "a", userAgent: "Chrome", lastUsedAt: new Date(), current: true },
    ]);
    renderAccount();
    await userEvent.click(
      withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: ACCOUNT_COPY.signOutEverywhere }),
    );

    await waitFor(() => expect(signOutEverywhere).toHaveBeenCalledTimes(1));
    expect(signOut).toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});

describe("PAGES-53: «Desconectar»", () => {
  it("PAGES-53: calls unlinkAccount once; on success toasts and the card shows «No hay cuentas conectadas.»", async () => {
    unlinkAccount.mockResolvedValue(OK);
    renderAccount(albaAccount({ providers: ["google"], hasPassword: true }));

    await userEvent.click(
      withinCard("Google").getByRole("button", { name: ACCOUNT_COPY.disconnect }),
    );

    await waitFor(() => expect(unlinkAccount).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(ACCOUNT_COPY.accountDisconnectedToast)).toBeInTheDocument();
    const googleCard = withinCard("Google");
    expect(googleCard.getByText("No hay cuentas conectadas.")).toBeInTheDocument();
    await waitFor(() => expect(googleCard.queryByRole("button")).not.toBeInTheDocument());
  });

  it("PAGES-53: a lastSignInMethod refusal toasts the dedicated copy, dropping the password instruction", async () => {
    unlinkAccount.mockResolvedValue({ success: false, error: "lastSignInMethod" });
    renderAccount(albaAccount({ providers: ["google"], hasPassword: true }));

    await userEvent.click(
      withinCard("Google").getByRole("button", { name: ACCOUNT_COPY.disconnect }),
    );

    expect(await screen.findByText(ACCOUNT_COPY.lastSignInMethodError)).toBeInTheDocument();
  });
});

describe("PAGES-54, PAGES-55: deleting the account", () => {
  it("PAGES-54: opens an alertdialog with the warning, the password field, the typed confirmation, disabled until both are filled", async () => {
    renderAccount(albaAccount({ hasPassword: true }));

    await userEvent.click(
      withinCard("Eliminar cuenta").getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );
    const confirm = await screen.findByRole("alertdialog", {
      name: ACCOUNT_COPY.deleteAccountQuestion,
    });

    expect(within(confirm).getByText(ACCOUNT_COPY.deleteWarning)).toBeInTheDocument();
    expect(within(confirm).getByLabelText("Tu contraseña")).toBeInTheDocument();
    const deleteButton = within(confirm).getByRole("button", {
      name: ACCOUNT_COPY.deleteAccountCta,
    });
    expect(deleteButton).toHaveAttribute("aria-disabled", "true");

    await userEvent.type(
      within(confirm).getByLabelText("Escribe ELIMINAR para confirmar"),
      "ELIMINAR",
    );
    await userEvent.type(within(confirm).getByLabelText("Tu contraseña"), "current-pw");

    expect(deleteButton).not.toHaveAttribute("aria-disabled", "true");
  });

  it("PAGES-54: a Google-only account has no password field", async () => {
    renderAccount(googleOnlyAccount());

    await userEvent.click(
      withinCard("Eliminar cuenta").getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );
    const confirm = await screen.findByRole("alertdialog", {
      name: ACCOUNT_COPY.deleteAccountQuestion,
    });

    expect(within(confirm).queryByLabelText("Tu contraseña")).not.toBeInTheDocument();
  });

  it("PAGES-55: on success signs the user out, sends them to / and toasts success", async () => {
    deleteAccount.mockResolvedValue(OK);
    renderAccount(albaAccount({ hasPassword: true }));
    await userEvent.click(
      withinCard("Eliminar cuenta").getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );
    const confirm = await screen.findByRole("alertdialog", {
      name: ACCOUNT_COPY.deleteAccountQuestion,
    });
    await userEvent.type(
      within(confirm).getByLabelText("Escribe ELIMINAR para confirmar"),
      "ELIMINAR",
    );
    await userEvent.type(within(confirm).getByLabelText("Tu contraseña"), "current-pw");

    await userEvent.click(
      within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
    expect(signOut).toHaveBeenCalled();
    expect(await screen.findByText(ACCOUNT_COPY.accountDeletedToast)).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("PAGES-55: currentPasswordIncorrect is a field error under «Tu contraseña», with no toast", async () => {
    deleteAccount.mockResolvedValue({ success: false, error: "currentPasswordIncorrect" });
    renderAccount(albaAccount({ hasPassword: true }));
    await userEvent.click(
      withinCard("Eliminar cuenta").getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );
    const confirm = await screen.findByRole("alertdialog", {
      name: ACCOUNT_COPY.deleteAccountQuestion,
    });
    await userEvent.type(
      within(confirm).getByLabelText("Escribe ELIMINAR para confirmar"),
      "ELIMINAR",
    );
    await userEvent.type(within(confirm).getByLabelText("Tu contraseña"), "wrong");

    await userEvent.click(
      within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );

    expect(
      await within(confirm).findByText(ACCOUNT_COPY.currentPasswordIncorrect),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });
});

/** Opens «Dos pasos» from «Activar» and gets past the password step to the setup step. */
async function openSetupStep() {
  startTwoFactorSetup.mockResolvedValue({
    success: true,
    otpauthUri: "otpauth://totp/x?secret=ABCDEF",
    secret: "ABCDEF",
    recoveryCodes: Array.from({ length: 10 }, (_, i) => `code-${i}`),
  });
  renderAccount(albaAccount({ twoFactorEnabled: false }));
  const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");
  await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "current-pw");
  await userEvent.click(
    within(dialog).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor }),
  );
  await within(dialog).findByDisplayValue("ABCDEF");
  return dialog;
}

/** Opens «¿Eliminar tu cuenta?» from its card. */
async function openDeletion() {
  await userEvent.click(
    withinCard("Eliminar cuenta").getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
  );
  return screen.findByRole("alertdialog", { name: ACCOUNT_COPY.deleteAccountQuestion });
}

/** Fills «¿Eliminar tu cuenta?» with the word and, given one, the password. */
async function fillDeletion(confirm: HTMLElement, word: string, password?: string) {
  await userEvent.type(within(confirm).getByLabelText("Escribe ELIMINAR para confirmar"), word);
  if (password) await userEvent.type(within(confirm).getByLabelText("Tu contraseña"), password);
}

describe("PAGES-71: rateLimited is a form alert above the primary button in every form dialog", () => {
  const RATE_LIMITED = { success: false, error: "rateLimited" };

  it("PAGES-71: «Cambiar correo»", async () => {
    requestEmailChange.mockResolvedValue(RATE_LIMITED);
    renderAccount();
    const { dialog } = await openDialog(
      "Correo",
      ACCOUNT_COPY.changeEmail,
      ACCOUNT_COPY.changeEmail,
    );
    await userEvent.type(
      within(dialog).getByLabelText("Nueva dirección de correo"),
      "new@example.com",
    );
    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "secret-pw");
    const primary = within(dialog).getByRole("button", { name: ACCOUNT_COPY.changeEmail });
    await userEvent.click(primary);

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(FORM_ALERTS.rateLimited);
    expect(precedes(alert, primary)).toBe(true);
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });

  it("PAGES-71: «Cambiar contraseña»", async () => {
    changePassword.mockResolvedValue(RATE_LIMITED);
    renderAccount();
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );
    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "current-pw");
    await userEvent.type(within(dialog).getByLabelText("Nueva contraseña"), "harbour-lentil-quilt");
    await userEvent.type(
      within(dialog).getByLabelText("Repite la contraseña"),
      "harbour-lentil-quilt",
    );
    const primary = within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword });
    await userEvent.click(primary);

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(FORM_ALERTS.rateLimited);
    expect(precedes(alert, primary)).toBe(true);
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });

  it("PAGES-71: «Dos pasos», the password step", async () => {
    startTwoFactorSetup.mockResolvedValue(RATE_LIMITED);
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");
    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "current-pw");
    const primary = within(dialog).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor });
    await userEvent.click(primary);

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(FORM_ALERTS.rateLimited);
    expect(precedes(alert, primary)).toBe(true);
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });

  it("PAGES-71: «¿Eliminar tu cuenta?»", async () => {
    deleteAccount.mockResolvedValue(RATE_LIMITED);
    renderAccount(albaAccount({ hasPassword: true }));
    const confirm = await openDeletion();
    await fillDeletion(confirm, "ELIMINAR", "current-pw");
    const primary = within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta });
    await userEvent.click(primary);

    const alert = await within(confirm).findByRole("alert");
    expect(alert).toHaveTextContent(FORM_ALERTS.rateLimited);
    expect(precedes(alert, primary)).toBe(true);
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });
});

describe("PAGES-40, PAGES-42: the actions' new version is the one the next save asserts (DATA-15)", () => {
  it("PAGES-40: a second name saved sends the version updateProfile answered with", async () => {
    updateProfile.mockResolvedValueOnce({ success: true, version: 9 }).mockResolvedValueOnce(OK);
    renderAccount(albaAccount({ name: "Alba", version: 7 }));

    const first = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);
    await userEvent.type(within(first.dialog).getByLabelText("Nombre"), " García");
    await userEvent.click(
      within(first.dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const second = await openDialog(
      "Alba García",
      ACCOUNT_COPY.changeName,
      ACCOUNT_COPY.changeName,
    );
    await userEvent.type(within(second.dialog).getByLabelText("Nombre"), " Ruiz");
    await userEvent.click(
      within(second.dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }),
    );

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(2));
    expect((updateProfile.mock.calls[0][0] as FormData).get("version")).toBe("7");
    expect((updateProfile.mock.calls[1][0] as FormData).get("version")).toBe("9");
  });

  it("PAGES-42: a name saved after a password change sends the version changePassword answered with", async () => {
    changePassword.mockResolvedValue({ success: true, version: 5 });
    updateProfile.mockResolvedValue(OK);
    renderAccount(albaAccount({ name: "Alba", version: 1 }));

    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );
    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "current-pw");
    await userEvent.type(within(dialog).getByLabelText("Nueva contraseña"), "harbour-lentil-quilt");
    await userEvent.type(
      within(dialog).getByLabelText("Repite la contraseña"),
      "harbour-lentil-quilt",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const name = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);
    await userEvent.type(within(name.dialog).getByLabelText("Nombre"), " García");
    await userEvent.click(
      within(name.dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }),
    );

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect((updateProfile.mock.calls[0][0] as FormData).get("version")).toBe("5");
  });
});

describe("PAGES-41, PAGES-42: what the forms send", () => {
  it("PAGES-42: submits the current and the new password with the version", async () => {
    changePassword.mockResolvedValue(OK);
    renderAccount(albaAccount({ version: 1 }));
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );

    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "current-pw");
    await userEvent.type(within(dialog).getByLabelText("Nueva contraseña"), "harbour-lentil-quilt");
    await userEvent.type(
      within(dialog).getByLabelText("Repite la contraseña"),
      "harbour-lentil-quilt",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword }));

    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1));
    const submitted = changePassword.mock.calls[0][0] as FormData;
    expect(submitted.get("currentPassword")).toBe("current-pw");
    expect(submitted.get("password")).toBe("harbour-lentil-quilt");
    expect(submitted.get("confirmPassword")).toBe("harbour-lentil-quilt");
    expect(submitted.get("version")).toBe("1");
  });

  it("PAGES-42: a repeat that does not match shows «Las contraseñas no coinciden» and sends nothing", async () => {
    renderAccount();
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );

    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "current-pw");
    await userEvent.type(within(dialog).getByLabelText("Nueva contraseña"), "harbour-lentil-quilt");
    await userEvent.type(
      within(dialog).getByLabelText("Repite la contraseña"),
      "harbour-lentil-quiet",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword }));

    expect(await within(dialog).findByText("Las contraseñas no coinciden")).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("PAGES-42: after the change, signs in nowhere, re-reads the session, closes with the toast and keeps the new version (BAUTH-2)", async () => {
    changePassword.mockResolvedValue({ success: true, version: 5 });
    updateProfile.mockResolvedValue(OK);
    renderAccount(albaAccount({ name: "Alba", email: "alba@example.com", version: 4 }));
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );

    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "current-pw");
    await userEvent.type(within(dialog).getByLabelText("Nueva contraseña"), "harbour-lentil-quilt");
    await userEvent.type(
      within(dialog).getByLabelText("Repite la contraseña"),
      "harbour-lentil-quilt",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText(ACCOUNT_COPY.passwordUpdated)).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("$sessionSignal");

    const name = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);
    await userEvent.type(within(name.dialog).getByLabelText("Nombre"), " García");
    await userEvent.click(
      within(name.dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }),
    );
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect((updateProfile.mock.calls[0][0] as FormData).get("version")).toBe("5");
  });

  it("PAGES-42: a refused change signs in nowhere and re-reads no session", async () => {
    changePassword.mockResolvedValue({ success: false, error: "currentPasswordIncorrect" });
    renderAccount();
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );

    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "wrong");
    await userEvent.type(within(dialog).getByLabelText("Nueva contraseña"), "harbour-lentil-quilt");
    await userEvent.type(
      within(dialog).getByLabelText("Repite la contraseña"),
      "harbour-lentil-quilt",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword }));

    await within(dialog).findByText(ACCOUNT_COPY.currentPasswordIncorrect);
    expect(signInEmail).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("PAGES-41: submits the new address and the current password", async () => {
    requestEmailChange.mockResolvedValue(OK);
    renderAccount();
    const { dialog } = await openDialog(
      "Correo",
      ACCOUNT_COPY.changeEmail,
      ACCOUNT_COPY.changeEmail,
    );

    await userEvent.type(
      within(dialog).getByLabelText("Nueva dirección de correo"),
      "new@example.com",
    );
    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "secret-pw");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.changeEmail }));

    await waitFor(() => expect(requestEmailChange).toHaveBeenCalledTimes(1));
    const submitted = requestEmailChange.mock.calls[0][0] as FormData;
    expect(submitted.get("email")).toBe("new@example.com");
    expect(submitted.get("currentPassword")).toBe("secret-pw");
  });

  it("PAGES-41: «Contraseña actual» left empty is required, and nothing is sent", async () => {
    renderAccount();
    const { dialog } = await openDialog(
      "Correo",
      ACCOUNT_COPY.changeEmail,
      ACCOUNT_COPY.changeEmail,
    );

    await userEvent.type(
      within(dialog).getByLabelText("Nueva dirección de correo"),
      "new@example.com",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.changeEmail }));

    expect(await within(dialog).findByText("La contraseña es obligatoria")).toBeInTheDocument();
    expect(requestEmailChange).not.toHaveBeenCalled();
  });
});

describe("PAGES-76: a state that gives way to another inside a dialog takes the focus", () => {
  it("PAGES-76: «Cambiar correo» sent moves the focus to «Cerrar»", async () => {
    requestEmailChange.mockResolvedValue(OK);
    renderAccount();
    const { dialog } = await openDialog(
      "Correo",
      ACCOUNT_COPY.changeEmail,
      ACCOUNT_COPY.changeEmail,
    );
    await userEvent.type(
      within(dialog).getByLabelText("Nueva dirección de correo"),
      "new@example.com",
    );
    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "secret-pw");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.changeEmail }));

    const close = await within(dialog).findByRole("button", { name: ACCOUNT_COPY.close });
    await waitFor(() => expect(close).toHaveFocus());
  });

  it("PAGES-76: «Dos pasos» past the password moves the focus to the key, its first control", async () => {
    const dialog = await openSetupStep();

    await waitFor(() => expect(within(dialog).getByDisplayValue("ABCDEF")).toHaveFocus());
  });

  it("PAGES-49: «Cambiar correo» opened again after its notice starts from the form", async () => {
    requestEmailChange.mockResolvedValue(OK);
    renderAccount();
    const { opener, dialog } = await openDialog(
      "Correo",
      ACCOUNT_COPY.changeEmail,
      ACCOUNT_COPY.changeEmail,
    );
    await userEvent.type(
      within(dialog).getByLabelText("Nueva dirección de correo"),
      "new@example.com",
    );
    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "secret-pw");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.changeEmail }));
    await userEvent.click(await within(dialog).findByRole("button", { name: ACCOUNT_COPY.close }));

    // Reopened at once, during the closing fade.
    await userEvent.click(opener);

    const reopened = await screen.findByRole("dialog", { name: ACCOUNT_COPY.changeEmail });
    expect(await within(reopened).findByLabelText("Nueva dirección de correo")).toHaveValue("");
    expect(within(reopened).queryByText(ACCOUNT_COPY.emailChangeSent)).not.toBeInTheDocument();
  });
});

describe("PAGES-73: where the focus starts in the other dialogs", () => {
  it("PAGES-73: «Cambiar correo» on «Nueva dirección de correo»", async () => {
    renderAccount();
    const { dialog } = await openDialog(
      "Correo",
      ACCOUNT_COPY.changeEmail,
      ACCOUNT_COPY.changeEmail,
    );

    await waitFor(() =>
      expect(within(dialog).getByLabelText("Nueva dirección de correo")).toHaveFocus(),
    );
  });

  it("PAGES-73: «Cambiar contraseña» on «Contraseña actual»", async () => {
    renderAccount();
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );

    await waitFor(() => expect(within(dialog).getByLabelText("Contraseña actual")).toHaveFocus());
  });

  it("PAGES-73: «Dos pasos» from «Activar» on «Tu contraseña»", async () => {
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");

    await waitFor(() => expect(within(dialog).getByLabelText("Tu contraseña")).toHaveFocus());
  });

  it("PAGES-73: «¿Eliminar tu cuenta?» on «Tu contraseña» for a password account", async () => {
    renderAccount(albaAccount({ hasPassword: true }));
    const confirm = await openDeletion();

    await waitFor(() => expect(within(confirm).getByLabelText("Tu contraseña")).toHaveFocus());
  });

  it("PAGES-73: «¿Eliminar tu cuenta?» on «Escribe ELIMINAR para confirmar» for a Google-only account", async () => {
    renderAccount(googleOnlyAccount());
    const confirm = await openDeletion();

    await waitFor(() =>
      expect(within(confirm).getByLabelText("Escribe ELIMINAR para confirmar")).toHaveFocus(),
    );
  });

  it("PAGES-73: the codes dialog on «Copiar códigos»", async () => {
    confirmTwoFactorSetup.mockResolvedValue(OK);
    const setup = await openSetupStep();
    await userEvent.type(
      within(setup).getByLabelText("Introduce el código de 6 dígitos"),
      "123456",
    );
    await userEvent.click(
      within(setup).getByRole("button", { name: ACCOUNT_COPY.activateTwoFactor }),
    );
    const codes = await screen.findByRole("alertdialog", {
      name: "Guarda tus códigos de recuperación",
    });

    await waitFor(() =>
      expect(within(codes).getByRole("button", { name: ACCOUNT_COPY.copyCodes })).toHaveFocus(),
    );
  });
});

describe("PAGES-45: the codes dialog's copy", () => {
  it("PAGES-45: says what each code does and that this is the only time they show", async () => {
    confirmTwoFactorSetup.mockResolvedValue(OK);
    const setup = await openSetupStep();
    await userEvent.type(
      within(setup).getByLabelText("Introduce el código de 6 dígitos"),
      "123456",
    );
    await userEvent.click(
      within(setup).getByRole("button", { name: ACCOUNT_COPY.activateTwoFactor }),
    );
    const codes = await screen.findByRole("alertdialog", {
      name: "Guarda tus códigos de recuperación",
    });

    expect(
      within(codes).getByText("Cada código sirve una vez y te deja entrar si pierdes el móvil."),
    ).toBeInTheDocument();
    expect(
      within(codes).getByText(
        "Es la única vez que se muestran. Guárdalos en un sitio seguro antes de continuar.",
      ),
    ).toBeInTheDocument();
  });
});

describe("PAGES-48: «Gestionar»'s two actions", () => {
  it("PAGES-48: «Desactivar dos pasos» submits the password and the code", async () => {
    disableTwoFactor.mockResolvedValue(OK);
    renderAccount(albaAccount({ twoFactorEnabled: true }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.manage, "Dos pasos");

    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.type(
      within(dialog).getByLabelText("Introduce el código de 6 dígitos"),
      "123456",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.disableTwoFactor }),
    );

    await waitFor(() => expect(disableTwoFactor).toHaveBeenCalledTimes(1));
    const submitted = disableTwoFactor.mock.calls[0][0] as FormData;
    expect(submitted.get("currentPassword")).toBe("current-pw");
    expect(submitted.get("code")).toBe("123456");
  });

  it("PAGES-48: «Desactivar dos pasos» with no code shows the code's field error and sends nothing", async () => {
    renderAccount(albaAccount({ twoFactorEnabled: true }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.manage, "Dos pasos");

    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.disableTwoFactor }),
    );

    expect(await within(dialog).findByText(ACCOUNT_COPY.totpInvalid)).toBeInTheDocument();
    expect(disableTwoFactor).not.toHaveBeenCalled();
  });

  it("PAGES-48: «Generar códigos nuevos» submits the password alone, then shows the codes", async () => {
    regenerateRecoveryCodes.mockResolvedValue({
      success: true,
      recoveryCodes: Array.from({ length: 10 }, (_, i) => `new-${i}`),
    });
    renderAccount(albaAccount({ twoFactorEnabled: true }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.manage, "Dos pasos");

    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.regenerateCodes }),
    );

    await waitFor(() => expect(regenerateRecoveryCodes).toHaveBeenCalledTimes(1));
    const submitted = regenerateRecoveryCodes.mock.calls[0][0] as FormData;
    expect(submitted.get("currentPassword")).toBe("current-pw");
    expect(submitted.has("code")).toBe(false);
    const codes = await screen.findByRole("alertdialog", {
      name: "Guarda tus códigos de recuperación",
    });
    expect(within(codes).getByText("new-0")).toBeInTheDocument();
  });

  it("PAGES-48: a wrong password on «Desactivar dos pasos» is «Tu contraseña actual no es correcta» under «Tu contraseña»", async () => {
    disableTwoFactor.mockResolvedValue({ success: false, error: "currentPasswordIncorrect" });
    renderAccount(albaAccount({ twoFactorEnabled: true }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.manage, "Dos pasos");

    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "wrong");
    await userEvent.type(
      within(dialog).getByLabelText("Introduce el código de 6 dígitos"),
      "123456",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.disableTwoFactor }),
    );

    await within(dialog).findByText(ACCOUNT_COPY.currentPasswordIncorrect);
    expect(within(dialog).getByLabelText("Tu contraseña")).toHaveAccessibleDescription(
      ACCOUNT_COPY.currentPasswordIncorrect,
    );
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });
});

describe("PAGES-50, PAGES-51: the «Sesiones» dialog's states and rows", () => {
  const THIS = { id: "a", userAgent: "Chrome/120 Windows", lastUsedAt: new Date(), current: true };
  const IPHONE = {
    id: "b",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1",
    lastUsedAt: new Date("2026-10-14T12:00:00.000Z"),
    current: false,
  };

  it("PAGES-50: loading is a polite status reading «Cargando…»; a failed read is an alert", async () => {
    let failRead: (error: Error) => void = () => undefined;
    listMySessions.mockReturnValue(
      new Promise((_, reject) => {
        failRead = reject;
      }),
    );
    renderAccount();
    await userEvent.click(
      withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Sesiones" });

    expect(within(dialog).getByRole("status")).toHaveTextContent("Cargando…");
    failRead(new Error("network down"));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      ACCOUNT_COPY.sessionsLoadError,
    );
  });

  it("PAGES-51: a row's «Cerrar sesión», named with its device, is busy while it runs and its row leaves the list", async () => {
    let finishRevoke: (value: { success: true }) => void = () => undefined;
    revokeMySession.mockReturnValue(
      new Promise((resolve) => {
        finishRevoke = resolve;
      }),
    );
    listMySessions.mockResolvedValueOnce([THIS, IPHONE]).mockResolvedValue([THIS]);
    renderAccount(albaWithTwoSessions());
    await userEvent.click(
      withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Sesiones" });
    const rowButton = await within(dialog).findByRole("button", {
      name: "Cerrar la sesión de Safari en iOS",
    });

    await userEvent.click(rowButton);

    expect(rowButton).toHaveAttribute("aria-busy", "true");
    expect(rowButton).toHaveAttribute("aria-disabled", "true");
    finishRevoke({ success: true });
    await waitFor(() =>
      expect(within(dialog).queryByText("Safari en iOS")).not.toBeInTheDocument(),
    );
    expect(revokeMySession).toHaveBeenCalledWith("b");
    expect(within(dialog).getByText("Este dispositivo")).toBeInTheDocument();
  });
});

describe("PAGES-53: «Desconectar» while it runs and when it fails", () => {
  it("PAGES-53: is busy while unlinkAccount runs", async () => {
    unlinkAccount.mockReturnValue(
      new Promise(() => {
        // Intentionally left pending.
      }),
    );
    renderAccount(albaAccount({ providers: ["google"], hasPassword: true }));
    const button = withinCard("Google").getByRole("button", { name: ACCOUNT_COPY.disconnect });

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("PAGES-53: a generic refusal is the error toast «Algo ha ido mal. Inténtalo de nuevo.» and Google stays", async () => {
    unlinkAccount.mockResolvedValue({ success: false, error: "generic" });
    renderAccount(albaAccount({ providers: ["google"], hasPassword: true }));

    await userEvent.click(
      withinCard("Google").getByRole("button", { name: ACCOUNT_COPY.disconnect }),
    );

    expect(await screen.findByText(FORM_ALERTS.generic)).toBeInTheDocument();
    expect(withinCard("Google").getByText(ACCOUNT_COPY.connected)).toBeInTheDocument();
  });
});

describe("PAGES-54, PAGES-55: the deletion form", () => {
  it("PAGES-54: «eliminar» in lower case keeps «Eliminar mi cuenta» aria-disabled", async () => {
    renderAccount(albaAccount({ hasPassword: true }));
    const confirm = await openDeletion();

    await fillDeletion(confirm, "eliminar", "current-pw");

    expect(
      within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    ).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(
      within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("PAGES-55: submits the password", async () => {
    deleteAccount.mockResolvedValue(OK);
    renderAccount(albaAccount({ hasPassword: true }));
    const confirm = await openDeletion();
    await fillDeletion(confirm, "ELIMINAR", "current-pw");

    await userEvent.click(
      within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
    expect((deleteAccount.mock.calls[0][0] as FormData).get("password")).toBe("current-pw");
  });

  it("PAGES-55: after a failure the button can be pressed again", async () => {
    deleteAccount.mockResolvedValue({ success: false, error: "generic" });
    renderAccount(albaAccount({ hasPassword: true }));
    const confirm = await openDeletion();
    await fillDeletion(confirm, "ELIMINAR", "current-pw");
    const button = within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta });

    await userEvent.click(button);

    expect(await within(confirm).findByRole("alert")).toHaveTextContent(FORM_ALERTS.generic);
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-disabled");
  });

  it("PAGES-72: while deleteAccount runs, Escape and «Cancelar» leave the confirmation open", async () => {
    deleteAccount.mockReturnValue(
      new Promise(() => {
        // Intentionally left pending.
      }),
    );
    renderAccount(albaAccount({ hasPassword: true }));
    const confirm = await openDeletion();
    await fillDeletion(confirm, "ELIMINAR", "current-pw");

    await userEvent.click(
      within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(confirm).getByRole("button", { name: ACCOUNT_COPY.cancel }));

    expect(screen.getByRole("alertdialog", { name: ACCOUNT_COPY.deleteAccountQuestion })).toBe(
      confirm,
    );
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });
});

/** Never answers: the request stays in flight for the rest of the test. */
function pending() {
  return new Promise(() => {
    // Intentionally left pending.
  });
}

/**
 * PAGES-2's busy button: `aria-disabled` (not natively disabled, so it keeps
 * the focus), `aria-busy`, the spinner first and the label unchanged.
 */
function expectBusy(button: HTMLElement, label: string) {
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(button).toHaveAttribute("aria-disabled", "true");
  expect(button).not.toBeDisabled();
  const spinner = button.firstElementChild;
  expect(spinner).toHaveClass("animate-spin");
  expect(spinner).toHaveAttribute("aria-hidden", "true");
  expect(button.textContent).toBe(label);
}

describe("PAGES-2: the account dialogs' buttons are busy while their request runs", () => {
  it("PAGES-2: «Guardar cambios» while updateProfile runs", async () => {
    updateProfile.mockReturnValue(pending());
    renderAccount(albaAccount({ name: "Alba" }));
    const { dialog } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

    await userEvent.type(within(dialog).getByLabelText("Nombre"), " García");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }));

    await waitFor(() =>
      expectBusy(
        within(dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }),
        ACCOUNT_COPY.saveChanges,
      ),
    );
  });

  it("PAGES-2: «Eliminar mi cuenta» while deleteAccount runs", async () => {
    deleteAccount.mockReturnValue(pending());
    renderAccount(albaAccount({ hasPassword: true }));
    const confirm = await openDeletion();
    await fillDeletion(confirm, "ELIMINAR", "current-pw");

    await userEvent.click(
      within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );

    await waitFor(() =>
      expectBusy(
        within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
        ACCOUNT_COPY.deleteAccountCta,
      ),
    );
  });

  it("PAGES-2: «Generar códigos nuevos» while regenerateRecoveryCodes runs, «Desactivar dos pasos» disabled beside it", async () => {
    regenerateRecoveryCodes.mockReturnValue(pending());
    renderAccount(albaAccount({ twoFactorEnabled: true }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.manage, "Dos pasos");

    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.regenerateCodes }),
    );

    await waitFor(() =>
      expectBusy(
        within(dialog).getByRole("button", { name: ACCOUNT_COPY.regenerateCodes }),
        ACCOUNT_COPY.regenerateCodes,
      ),
    );
    expect(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.disableTwoFactor }),
    ).toBeDisabled();
  });

  it("PAGES-2: «Desactivar dos pasos» while disableTwoFactor runs, «Generar códigos nuevos» disabled beside it", async () => {
    disableTwoFactor.mockReturnValue(pending());
    renderAccount(albaAccount({ twoFactorEnabled: true }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.manage, "Dos pasos");

    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.type(
      within(dialog).getByLabelText("Introduce el código de 6 dígitos"),
      "123456",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.disableTwoFactor }),
    );

    await waitFor(() =>
      expectBusy(
        within(dialog).getByRole("button", { name: ACCOUNT_COPY.disableTwoFactor }),
        ACCOUNT_COPY.disableTwoFactor,
      ),
    );
    expect(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.regenerateCodes }),
    ).toBeDisabled();
  });
});

describe("PAGES-42: the account dialogs' password placeholders", () => {
  it("PAGES-42: every current-password field reads «Tu contraseña»", async () => {
    renderAccount(albaAccount({ hasPassword: true, twoFactorEnabled: true }));

    const email = await openDialog("Correo", ACCOUNT_COPY.changeEmail, ACCOUNT_COPY.changeEmail);
    expect(within(email.dialog).getByLabelText("Contraseña actual")).toHaveAttribute(
      "placeholder",
      "Tu contraseña",
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const password = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );
    expect(within(password.dialog).getByLabelText("Contraseña actual")).toHaveAttribute(
      "placeholder",
      "Tu contraseña",
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const twoFactor = await openDialog("Dos pasos", ACCOUNT_COPY.manage, "Dos pasos");
    expect(within(twoFactor.dialog).getByLabelText("Tu contraseña")).toHaveAttribute(
      "placeholder",
      "Tu contraseña",
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const confirm = await openDeletion();
    expect(within(confirm).getByLabelText("Tu contraseña")).toHaveAttribute(
      "placeholder",
      "Tu contraseña",
    );
  });

  it("PAGES-42: «Nueva contraseña» has no placeholder and «Repite la contraseña» keeps «Otra vez, por si acaso»", async () => {
    renderAccount();
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );

    expect(within(dialog).getByLabelText("Nueva contraseña")).not.toHaveAttribute("placeholder");
    expect(within(dialog).getByLabelText("Repite la contraseña")).toHaveAttribute(
      "placeholder",
      "Otra vez, por si acaso",
    );
  });
});

describe("PAGES-42, PAGES-44, PAGES-55: a server field error takes the focus", () => {
  it("PAGES-42: a wrong current password focuses «Contraseña actual»", async () => {
    changePassword.mockResolvedValue({ success: false, error: "currentPasswordIncorrect" });
    renderAccount();
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );

    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "wrong");
    await userEvent.type(within(dialog).getByLabelText("Nueva contraseña"), "harbour-lentil-quilt");
    await userEvent.type(
      within(dialog).getByLabelText("Repite la contraseña"),
      "harbour-lentil-quilt",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword }));

    await within(dialog).findByText(ACCOUNT_COPY.currentPasswordIncorrect);
    expect(within(dialog).getByLabelText("Contraseña actual")).toHaveFocus();
  });

  it("PAGES-44: a wrong password in «Dos pasos» focuses «Tu contraseña»", async () => {
    startTwoFactorSetup.mockResolvedValue({ success: false, error: "currentPasswordIncorrect" });
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");

    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "wrong");
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor }),
    );

    await within(dialog).findByText(ACCOUNT_COPY.currentPasswordIncorrect);
    expect(within(dialog).getByLabelText("Tu contraseña")).toHaveFocus();
  });

  it("PAGES-55: a wrong password in «¿Eliminar tu cuenta?» focuses «Tu contraseña»", async () => {
    deleteAccount.mockResolvedValue({ success: false, error: "currentPasswordIncorrect" });
    renderAccount(albaAccount({ hasPassword: true }));
    const confirm = await openDeletion();
    await fillDeletion(confirm, "ELIMINAR", "wrong");

    await userEvent.click(
      within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );

    await within(confirm).findByText(ACCOUNT_COPY.currentPasswordIncorrect);
    expect(within(confirm).getByLabelText("Tu contraseña")).toHaveFocus();
  });
});

describe("PAGES-4, PAGES-71: a refusal with no code, or a thrown action, reads as generic", () => {
  it("PAGES-71: «Cambiar nombre» whose action throws shows the generic form alert", async () => {
    updateProfile.mockRejectedValue(new Error("network down"));
    renderAccount(albaAccount({ name: "Alba" }));
    const { dialog } = await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

    await userEvent.type(within(dialog).getByLabelText("Nombre"), " García");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.saveChanges }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(FORM_ALERTS.generic);
  });

  it("PAGES-43: a refused verification email with no code is the generic error toast", async () => {
    requestEmailVerification.mockResolvedValue({ success: false });
    renderAccount(albaAccount({ emailConfirmed: false }));

    await userEvent.click(
      withinCard("Correo").getByRole("button", { name: ACCOUNT_COPY.sendVerification }),
    );

    await waitFor(() =>
      expect(document.querySelector("[data-sonner-toast]")).toHaveTextContent(FORM_ALERTS.generic),
    );
  });
});

describe("PAGES-50, PAGES-51: the «Sesiones» dialog's read and its refusals", () => {
  it("PAGES-50: «Reintentar» reads the sessions again and shows them", async () => {
    // The second read answers later, as a real request does: until then the
    // alert stays and «Reintentar» is busy, with no placeholder rows between
    // (amended 2026-10-16), and the list then takes the alert's place.
    let answer: (sessions: unknown[]) => void = () => undefined;
    listMySessions.mockRejectedValueOnce(new Error("network down")).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderAccount();
    await userEvent.click(
      withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Sesiones" });

    const retry = await within(dialog).findByRole("button", { name: ACCOUNT_COPY.retry });
    await userEvent.click(retry);
    await waitFor(() => expect(listMySessions).toHaveBeenCalledTimes(2));
    expect(retry).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByText(ACCOUNT_COPY.sessionsLoadError)).toBeInTheDocument();
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
    await act(async () => {
      answer([{ id: "a", userAgent: "Chrome/120 Windows", lastUsedAt: new Date(), current: true }]);
    });

    expect(await within(dialog).findByText("Chrome en Windows")).toBeInTheDocument();
    expect(within(dialog).queryByText(ACCOUNT_COPY.sessionsLoadError)).not.toBeInTheDocument();
  });

  // The round-3 race: a retry answered at once must still end on the list,
  // never on placeholder rows stuck on screen.
  it("PAGES-50: «Reintentar» answered at once shows the list", async () => {
    listMySessions
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce([
        { id: "a", userAgent: "Chrome/120 Windows", lastUsedAt: new Date(), current: true },
      ]);
    renderAccount();
    await userEvent.click(
      withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Sesiones" });

    await userEvent.click(await within(dialog).findByRole("button", { name: ACCOUNT_COPY.retry }));

    expect(await within(dialog).findByText("Chrome en Windows")).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).queryByRole("status")).not.toBeInTheDocument());
    expect(within(dialog).queryByText(ACCOUNT_COPY.sessionsLoadError)).not.toBeInTheDocument();
    expect(listMySessions).toHaveBeenCalledTimes(2);
  });

  it("PAGES-50: a read that answers no session at all (this one ended elsewhere) is the failed read with «Reintentar», never an empty list", async () => {
    listMySessions.mockResolvedValue([]);
    renderAccount();
    await userEvent.click(
      withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Sesiones" });

    expect(await within(dialog).findByText(ACCOUNT_COPY.sessionsLoadError)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: ACCOUNT_COPY.retry })).toBeInTheDocument();
    expect(within(dialog).queryByRole("list")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(dialog).queryByRole("button", { name: ACCOUNT_COPY.closeOthers }),
      ).not.toBeInTheDocument(),
    );
  });

  it("PAGES-51: «Cerrar las demás» calls revokeOtherMySessions once", async () => {
    revokeOtherMySessions.mockResolvedValue(OK);
    listMySessions.mockResolvedValue([
      { id: "a", userAgent: "Chrome/120 Windows", lastUsedAt: new Date(), current: true },
    ]);
    renderAccount();
    await userEvent.click(
      withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Sesiones" });
    await within(dialog).findByText("Chrome en Windows");

    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.closeOthers }));

    expect(await screen.findByText(ACCOUNT_COPY.othersSignedOutToast)).toBeInTheDocument();
    expect(revokeOtherMySessions).toHaveBeenCalledTimes(1);
  });

  it("PAGES-51: a refused «Cerrar las demás» is the error toast with its copy, and no success toast", async () => {
    revokeOtherMySessions.mockResolvedValue({ success: false, error: "rateLimited" });
    listMySessions.mockResolvedValue([
      { id: "a", userAgent: "Chrome/120 Windows", lastUsedAt: new Date(), current: true },
    ]);
    renderAccount();
    await userEvent.click(
      withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Sesiones" });
    await within(dialog).findByText("Chrome en Windows");

    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.closeOthers }));

    await waitFor(() =>
      expect(document.querySelector("[data-sonner-toast]")).toHaveTextContent(
        FORM_ALERTS.rateLimited,
      ),
    );
    expect(screen.queryByText(ACCOUNT_COPY.othersSignedOutToast)).not.toBeInTheDocument();
  });
});

describe("PAGES-76: the focus after «Desconectar»", () => {
  it("PAGES-76: once Google is disconnected, the focus moves to the Google card's heading, focusable from script only", async () => {
    unlinkAccount.mockResolvedValue(OK);
    renderAccount(albaAccount({ providers: ["google"], hasPassword: true }));

    await userEvent.click(
      withinCard("Google").getByRole("button", { name: ACCOUNT_COPY.disconnect }),
    );

    const heading = withinCard("Google").getByRole("heading", { name: "Google" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("PAGES-76: a refused disconnect leaves the focus on «Desconectar»", async () => {
    unlinkAccount.mockResolvedValue({ success: false, error: "lastSignInMethod" });
    renderAccount(albaAccount({ providers: ["google"], hasPassword: true }));
    const button = withinCard("Google").getByRole("button", { name: ACCOUNT_COPY.disconnect });

    await userEvent.click(button);

    expect(await screen.findByText(ACCOUNT_COPY.lastSignInMethodError)).toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});

describe("PAGES-54, PAGES-72: the deletion stays locked until the page leaves", () => {
  it("PAGES-72: after deleteAccount succeeds, while the sign-out runs, Escape and «Cancelar» do nothing and the button stays busy", async () => {
    deleteAccount.mockResolvedValue(OK);
    signOut.mockReturnValue(pending());
    renderAccount(albaAccount({ hasPassword: true }));
    const confirm = await openDeletion();
    await fillDeletion(confirm, "ELIMINAR", "current-pw");

    await userEvent.click(
      within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(confirm).getByRole("button", { name: ACCOUNT_COPY.cancel }));

    expect(screen.getByRole("alertdialog", { name: ACCOUNT_COPY.deleteAccountQuestion })).toBe(
      confirm,
    );
    expectBusy(
      within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
      ACCOUNT_COPY.deleteAccountCta,
    );
    expect(push).not.toHaveBeenCalled();
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/redesign-pages.md (PAGES-38, PAGES-42, PAGES-44, PAGES-48;
// RULES.md §22 item 3): the dialogs the deleted ChangePasswordForm and
// TwoFactorCard tests covered with axe, now that they open in the frame.
describe("PAGES-38: the account dialogs have no accessibility violations", () => {
  it("PAGES-38: «Cambiar nombre» has no accessibility violations", async () => {
    renderAccount(albaAccount());
    await openDialog("Alba", ACCOUNT_COPY.changeName, ACCOUNT_COPY.changeName);

    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("PAGES-42: «Cambiar contraseña» has no accessibility violations", async () => {
    renderAccount(albaAccount());
    await openDialog("Contraseña", ACCOUNT_COPY.changePassword, ACCOUNT_COPY.changePassword);

    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("PAGES-44: «Dos pasos», the password step, has no accessibility violations", async () => {
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");

    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("PAGES-44: «Dos pasos», the setup step, has no accessibility violations", async () => {
    startTwoFactorSetup.mockResolvedValue({
      success: true,
      otpauthUri: "otpauth://totp/x?secret=ABCDEF",
      secret: "ABCDEF",
      recoveryCodes: Array.from({ length: 10 }, (_, i) => `code-${i}`),
    });
    renderAccount(albaAccount({ twoFactorEnabled: false }));
    const { dialog } = await openDialog("Dos pasos", ACCOUNT_COPY.activate, "Dos pasos");
    await userEvent.type(within(dialog).getByLabelText("Tu contraseña"), "current-pw");
    await userEvent.click(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.configureTwoFactor }),
    );
    await within(dialog).findByDisplayValue("ABCDEF");

    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("PAGES-48: «Gestionar» has no accessibility violations", async () => {
    renderAccount(albaAccount({ twoFactorEnabled: true }));
    await openDialog("Dos pasos", ACCOUNT_COPY.manage, "Dos pasos");

    expect(await axe(document.body)).toHaveNoViolations();
  });
});

// docs/specs/redesign-pages.md (PAGES-2's busy, amended 2026-10-16): a busy
// button is aria-disabled, not natively disabled, so the focus stays on it and
// a second press is ignored.
describe("PAGES-2: a busy button keeps the focus and ignores a press", () => {
  it("PAGES-2: «Enviar correo de verificación» keeps the focus while busy, and Enter again sends nothing", async () => {
    let resolveCall: (value: { success: false; error: "generic" }) => void = () => undefined;
    requestEmailVerification.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );
    renderAccount(albaAccount({ emailConfirmed: false }));
    const button = withinCard("Correo").getByRole("button", {
      name: ACCOUNT_COPY.sendVerification,
    });

    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(requestEmailVerification).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCall({ success: false, error: "generic" });
    });
    expect(await screen.findByText(FORM_ALERTS.generic)).toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).not.toHaveAttribute("aria-disabled");
  });
});

describe("PAGES-42: the «Sesiones» card after a password change", () => {
  it("PAGES-42: a change that succeeds reads the page again, so the ended sessions leave the card", async () => {
    changePassword.mockResolvedValue({ success: true, version: 2 });
    renderAccount(albaWithTwoSessions());
    const { dialog } = await openDialog(
      "Contraseña",
      ACCOUNT_COPY.changePassword,
      ACCOUNT_COPY.changePassword,
    );

    await userEvent.type(within(dialog).getByLabelText("Contraseña actual"), "current-pw");
    await userEvent.type(within(dialog).getByLabelText("Nueva contraseña"), "harbour-lentil-quilt");
    await userEvent.type(
      within(dialog).getByLabelText("Repite la contraseña"),
      "harbour-lentil-quilt",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.savePassword }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });
});

/** Opens «Sesiones» on this device alone and presses «Cerrar sesión en todas partes». */
async function signOutEverywhereFromDialog() {
  listMySessions.mockResolvedValue([
    { id: "a", userAgent: "Chrome/120 Windows", lastUsedAt: new Date(), current: true },
  ]);
  renderAccount();
  await userEvent.click(
    withinCard("Sesiones").getByRole("button", { name: ACCOUNT_COPY.closeOthers }),
  );
  const dialog = await screen.findByRole("dialog", { name: "Sesiones" });
  await userEvent.click(
    await within(dialog).findByRole("button", { name: ACCOUNT_COPY.signOutEverywhere }),
  );
  return dialog;
}

describe("PAGES-72: «Cerrar sesión en todas partes» through the sign-out", () => {
  it("PAGES-72: after signOutEverywhere succeeds, while the sign-out runs, Escape and «Cerrar» do nothing and the button stays busy", async () => {
    signOutEverywhere.mockResolvedValue(OK);
    signOut.mockReturnValue(pending());
    const dialog = await signOutEverywhereFromDialog();

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.close }));

    expect(screen.getByRole("dialog", { name: "Sesiones" })).toBe(dialog);
    expectBusy(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.signOutEverywhere }),
      ACCOUNT_COPY.signOutEverywhere,
    );
    expect(within(dialog).getByRole("button", { name: ACCOUNT_COPY.closeOthers })).toBeDisabled();
    expect(signOutEverywhere).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("PAGES-51: a sign-out that throws is reported, toasts the generic error and lets the dialog go", async () => {
    signOutEverywhere.mockResolvedValue(OK);
    signOut.mockRejectedValue(new Error("network down"));
    const dialog = await signOutEverywhereFromDialog();

    expect(await screen.findByText(FORM_ALERTS.generic)).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(
      within(dialog).getByRole("button", { name: ACCOUNT_COPY.signOutEverywhere }),
    ).not.toHaveAttribute("aria-busy", "true");

    await userEvent.click(within(dialog).getByRole("button", { name: ACCOUNT_COPY.close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("PAGES-55: a sign-out that throws after the deletion", () => {
  it("PAGES-55: is reported, toasts the generic error and lets the confirmation go", async () => {
    deleteAccount.mockResolvedValue(OK);
    signOut.mockRejectedValue(new Error("network down"));
    renderAccount(albaAccount({ hasPassword: true }));
    const confirm = await openDeletion();
    await fillDeletion(confirm, "ELIMINAR", "current-pw");

    await userEvent.click(
      within(confirm).getByRole("button", { name: ACCOUNT_COPY.deleteAccountCta }),
    );

    expect(await screen.findByText(FORM_ALERTS.generic)).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole("button", { name: ACCOUNT_COPY.cancel }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});
