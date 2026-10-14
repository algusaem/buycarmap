import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { CreateAlert, type CreateAlertProps } from "./CreateAlert";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const useSession = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => useSession() },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from "sonner";

vi.mock("@/server/alerts/actions", () => ({
  createAlert: vi.fn(),
}));
import { createAlert } from "@/server/alerts/actions";

const SIGNED_IN = { data: { user: { id: "user-ada" } }, isPending: false };
const SIGNED_OUT = { data: null, isPending: false };

const BASE: CreateAlertProps = {
  open: true,
  criteria: { brand: "Toyota", model: "Corolla", maxPrice: 20000 },
  placeName: "Madrid",
  onClose: vi.fn(),
};

beforeEach(() => {
  push.mockReset();
  vi.mocked(createAlert).mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  useSession.mockReturnValue(SIGNED_IN);
});

describe("MAPUI-39: CreateAlert — the dialog", () => {
  it("MAPUI-39: shows the prefilled name, the search summary, Crear alerta and Cancelar", () => {
    renderWithI18n(<CreateAlert {...BASE} />, { locale: "es" });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /nombre/i })).toHaveValue("Toyota Corolla · Madrid");
    expect(screen.getByText(/Hasta 20.000/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear alerta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });
});

describe("MAPUI-41: CreateAlert — too broad", () => {
  it("MAPUI-41: a search with no brand, no maximum price and no place disables Crear alerta and shows the notice", () => {
    renderWithI18n(<CreateAlert {...BASE} criteria={{}} placeName={undefined} />, {
      locale: "es",
    });

    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent(
      "Añade una marca, un precio máximo o una zona para crear la alerta.",
    );
    expect(screen.getByRole("button", { name: "Crear alerta" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("MAPUI-41: pressing the disabled Crear alerta sends nothing", async () => {
    renderWithI18n(<CreateAlert {...BASE} criteria={{}} placeName={undefined} />, {
      locale: "es",
    });

    await userEvent.click(screen.getByRole("button", { name: "Crear alerta" }));

    expect(createAlert).not.toHaveBeenCalled();
  });

  it("MAPUI-41: a brand with an unrelated invalid field is not reported as too broad", () => {
    renderWithI18n(
      <CreateAlert {...BASE} criteria={{ brand: "Toyota", maxKm: -100 }} placeName={undefined} />,
      { locale: "es" },
    );

    expect(
      screen.queryByText("Añade una marca, un precio máximo o una zona para crear la alerta."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear alerta" })).not.toHaveAttribute(
      "aria-disabled",
    );
  });
});

describe("MAPUI-42: CreateAlert — creating", () => {
  it("MAPUI-42: calls createAlert with the criteria minus timeFilter and the trimmed name", async () => {
    vi.mocked(createAlert).mockResolvedValue({ ok: true, value: { created: true } });
    renderWithI18n(
      <CreateAlert
        {...BASE}
        criteria={{ brand: "Toyota", maxPrice: 20000, timeFilter: "today" }}
      />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Crear alerta" }));

    expect(createAlert).toHaveBeenCalledWith(
      { brand: "Toyota", maxPrice: 20000 },
      expect.any(String),
    );
  });

  it("MAPUI-42: on success closes the dialog and shows the Alerta creada toast with Ver alertas", async () => {
    vi.mocked(createAlert).mockResolvedValue({ ok: true, value: { created: true } });
    const onClose = vi.fn();
    renderWithI18n(<CreateAlert {...BASE} onClose={onClose} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Crear alerta" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      "Alerta creada",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Ver alertas", href: "/alerts" }),
      }),
    );
  });
});

describe("MAPUI-43: CreateAlert — already existed", () => {
  it("MAPUI-43: created:false closes the dialog and shows Ya tienes esta alerta with Ver alertas", async () => {
    vi.mocked(createAlert).mockResolvedValue({ ok: true, value: { created: false } });
    const onClose = vi.fn();
    renderWithI18n(<CreateAlert {...BASE} onClose={onClose} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Crear alerta" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      "Ya tienes esta alerta",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Ver alertas", href: "/alerts" }),
      }),
    );
  });
});

describe("MAPUI-44: CreateAlert — empty name", () => {
  it("MAPUI-44: an empty name, once trimmed, shows Ponle un nombre a la alerta. and sends nothing", async () => {
    renderWithI18n(<CreateAlert {...BASE} />, { locale: "es" });

    const nameField = screen.getByRole("textbox", { name: /nombre/i });
    await userEvent.clear(nameField);
    await userEvent.type(nameField, "   ");
    await userEvent.click(screen.getByRole("button", { name: "Crear alerta" }));

    expect(screen.getByText("Ponle un nombre a la alerta.")).toBeInTheDocument();
    expect(createAlert).not.toHaveBeenCalled();
  });
});

describe("MAPUI-45: CreateAlert — a refused create", () => {
  it.each([
    ["tooManyAlerts", "Has alcanzado el número máximo de alertas."],
    [
      "criteriaTooBroad",
      "Esa alerta es demasiado amplia. Añade una marca, un precio máximo o una ubicación.",
    ],
    ["invalidCriteria", "Esos filtros de alerta no son válidos."],
    ["unauthenticated", "Inicia sesión para gestionar tus alertas."],
  ])("MAPUI-45: %s keeps the dialog open and shows its message inline", async (code, message) => {
    vi.mocked(createAlert).mockResolvedValue({
      ok: false,
      error: { code, messageKey: `alertErrors.${code}` },
    } as never);
    const onClose = vi.fn();
    renderWithI18n(<CreateAlert {...BASE} onClose={onClose} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Crear alerta" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});

// The sign-in redirect itself happens where «Crear alerta» is pressed
// (components/map/MapView.test.tsx, MAPUI-46); the dialog only never shows
// without a session.
describe("MAPUI-46: CreateAlert — no session", () => {
  it.each([
    ["signed out", SIGNED_OUT],
    ["while the session is pending", { data: null, isPending: true }],
  ])("MAPUI-46: %s, neither the sheet nor the desktop card is drawn", (_case, session) => {
    useSession.mockReturnValue(session);
    const { container } = renderWithI18n(
      <>
        <CreateAlert {...BASE} />
        <CreateAlert {...BASE} inline />
      </>,
      { locale: "es" },
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("MAPUI-42: CreateAlert — the criteria and the name sent", () => {
  it("MAPUI-42: sends the trimmed name and every criterion but timeFilter and the ?q= text, under the full summary", async () => {
    vi.mocked(createAlert).mockResolvedValue({ ok: true, value: { created: true } });
    renderWithI18n(
      <CreateAlert
        {...BASE}
        criteria={{
          brand: "Toyota",
          maxPrice: 20000,
          latitude: 40.4168,
          longitude: -3.7038,
          distanceInKm: 50,
          timeFilter: "today",
          keywords: "golf",
        }}
      />,
      { locale: "es" },
    );

    // «Publicado» never reaches the summary either (MAPUI-40). getByText
    // reads the no-break space before «€» as a plain one.
    expect(screen.getByText("Toyota · Hasta 20.000 € · Madrid · 50 km")).toBeInTheDocument();
    const nameField = screen.getByRole("textbox", { name: /nombre/i });
    await userEvent.clear(nameField);
    await userEvent.type(nameField, "  Mi alerta  ");
    await userEvent.click(screen.getByRole("button", { name: "Crear alerta" }));

    expect(createAlert).toHaveBeenCalledWith(
      { brand: "Toyota", maxPrice: 20000, latitude: 40.4168, longitude: -3.7038, distanceInKm: 50 },
      "Mi alerta",
    );
    const [sentCriteria] = vi.mocked(createAlert).mock.calls[0];
    expect(sentCriteria).not.toHaveProperty("timeFilter");
    expect(sentCriteria).not.toHaveProperty("keywords");
  });
});

describe("MAPUI-45: CreateAlert — a thrown create", () => {
  it("MAPUI-45: a create that fails on the network keeps the dialog open and shows its message inline", async () => {
    vi.mocked(createAlert).mockRejectedValue(new Error("network down"));
    const onClose = vi.fn();
    renderWithI18n(<CreateAlert {...BASE} onClose={onClose} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Crear alerta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No hemos podido crear la alerta. Vuelve a intentarlo.",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("MAPUI-44: CreateAlert — the name is checked on leaving it", () => {
  it("MAPUI-44: emptying the name and leaving the field shows the error before any press", async () => {
    renderWithI18n(<CreateAlert {...BASE} />, { locale: "es" });

    await userEvent.clear(screen.getByRole("textbox", { name: /nombre/i }));
    await userEvent.tab();

    expect(await screen.findByText("Ponle un nombre a la alerta.")).toBeInTheDocument();
    expect(createAlert).not.toHaveBeenCalled();
  });
});

describe("MAPUI-39: CreateAlert — accessibility", () => {
  it("MAPUI-39: the phone sheet has no axe violations", async () => {
    const { baseElement } = renderWithI18n(<CreateAlert {...BASE} />, { locale: "es" });

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("MAPUI-39: the desktop card, too broad, has no axe violations", async () => {
    const { container } = renderWithI18n(
      <CreateAlert {...BASE} inline criteria={{}} placeName={undefined} />,
      { locale: "es" },
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

interface WithOpenerProps {
  open: boolean;
}

/** The phone sheet beside the button that opened it, as the results sheet's «Crear alerta». */
function WithOpener({ open }: WithOpenerProps) {
  const openerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={openerRef} type="button">
        Abrir
      </button>
      <CreateAlert {...BASE} open={open} returnFocusRef={openerRef} />
    </>
  );
}

describe("MAPUI-39: CreateAlert — the phone sheet's focus", () => {
  it("MAPUI-39: opens with the focus on its title, not the name field, so no keyboard pops up", async () => {
    renderWithI18n(<CreateAlert {...BASE} />, { locale: "es" });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "CREAR ALERTA" })).toHaveFocus(),
    );
    expect(screen.getByRole("textbox", { name: /nombre/i })).not.toHaveFocus();
  });

  it("MAPUI-39: closing it gives the focus back to the button that opened it", async () => {
    const { rerender } = renderWithI18n(<WithOpener open />, { locale: "es" });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "CREAR ALERTA" })).toHaveFocus(),
    );

    rerender(<WithOpener open={false} />);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Abrir" })).toHaveFocus();
  });
});
