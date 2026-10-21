import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { restoreMatchMedia, stubPhoneWidth } from "@/test/utils/viewport";
import { LegalContent } from "./LegalContent";
import esMessages from "@/messages/es.json";
import enMessages from "@/messages/en.json";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

// I18nProvider (via renderWithI18n) calls useRouter, so the app router must be
// mocked even though this component only reads translations.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("LegalContent", () => {
  it("renders the Terms document with its heading and sections", () => {
    renderWithI18n(<LegalContent doc="terms" />);

    expect(screen.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeInTheDocument();
    // First and last section headings render, so the sections list is mapped.
    // amended 2026-10-16, PAGES-62
    expect(
      screen.getByRole("heading", { level: 2, name: "About the service" }),
    ).toBeInTheDocument();
    // amended 2026-10-16, PAGES-62
    expect(screen.getByRole("heading", { level: 2, name: "Contact" })).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it("renders the Privacy document when doc='privacy'", () => {
    renderWithI18n(<LegalContent doc="privacy" />);

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    // amended 2026-10-16, PAGES-62
    expect(
      screen.getByRole("heading", { level: 2, name: "Information we collect" }),
    ).toBeInTheDocument();
  });

  it("selects content by the doc prop and does not leak the other document", () => {
    renderWithI18n(<LegalContent doc="privacy" />);

    // "About the service" is a Terms-only heading; it must not appear here.
    expect(screen.queryByText("About the service")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Terms of Service" })).not.toBeInTheDocument();
  });

  it("FRONT-27: renders the English privacy copy from the spec's worked example word for word (amended 2026-10-12, LOOK — redesign-foundation.md)", () => {
    renderWithI18n(<LegalContent doc="privacy" />);

    expect(screen.getByText("Last updated: 21 October 2026")).toBeInTheDocument();

    // FRONT-27 amendment: the Cookies section no longer names the theme —
    // there is nothing left to keep in local storage.
    expect(
      screen.queryByText(
        /Your theme choice is kept in your browser's local storage, not in a cookie\.?/,
      ),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(
        "If you create an account, we store your email address, an optional display name, and a securely hashed password — never the password itself. If you sign in with Google, we store the identifier of that account, the sign-in tokens it issues and the address of your profile picture. If you turn on two-factor authentication, we store its secret in encrypted form. We also store the listings you save as favourites, the alerts you create with their search criteria (including any location you chose or, if the search started from “Your location”, your approximate location), your language so emails reach you in it, and, for each signed-in session, the IP address and browser it came from, so you can see and end your sessions from your account page. We do not keep a history of your searches. To protect the service from abuse, we process your IP address and, when you sign in or ask for a password reset, your email address.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "We use your data to provide the service: to authenticate you, keep you signed in, keep your favourites and alerts, send you account and alert emails, protect the service from abuse, and improve how BuyCarMap works. We do not sell your personal data.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /We use only the cookies the app needs to work:.*We do not use advertising or analytics cookies\./,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "We rely on these external providers, and each receives only what it needs: Neon (database hosting) stores everything we keep; Vercel (hosting) receives every request, including your IP address; Resend (email delivery) receives your email address and the content of the emails we send you; Google (sign-in) receives your sign-in request, only if you choose to sign in with Google; Have I Been Pwned (leaked-password check) receives the first five characters of a one-way hash of a new password, never the password itself; Upstash (abuse protection) receives your IP address and a one-way hash of your email address, kept for at most one hour; Sentry (error reports) receives technical details of errors, without cookies, your IP address or your account details; OpenStreetMap / Nominatim (place search) receives the place you type, straight from your browser; OpenFreeMap (map tiles) receives tile requests straight from your browser, which show the area you are viewing; Wallapop (listings) receives your search filters and the coordinates of the search: the location you chose, your browser's position, or the centre of Spain; coches.net and Milanuncios (listings) receive your search filters. Our server sends the requests to Wallapop, coches.net and Milanuncios, so they see its address, not yours. Their handling of any data is governed by their own privacy policies.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "We keep your account data, favourites and alerts for as long as your account is active. A favourite or alert you remove is erased 30 days later. When you delete your account, its data is removed at once, except the search criteria of an alert that another user's alert also uses: those are kept, no longer linked to you, until no alert uses them. Unconfirmed sign-ups, password-reset and confirmation links, and abuse-protection records are deleted after they expire.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "To centre the map on you, we may ask your browser for your location. It is used to centre the map and to search near you, so our server sends its coordinates to Wallapop with your search. It is never stored on our servers unless you save it as part of an alert. You can decline, and we fall back to the centre of Spain.",
      ),
    ).toBeInTheDocument();
  });

  it("FRONT-27: the Spanish messages carry the spec's worked example word for word (amended 2026-10-12, LOOK — redesign-foundation.md)", () => {
    // renderWithI18n always wraps with the English messages (test/utils/render.tsx),
    // so the Spanish copy is asserted directly against messages/es.json.
    const privacy = (
      esMessages as {
        legal: { privacy: { updated: string; sections: { heading: string; body: string }[] } };
      }
    ).legal.privacy;
    const bodyByHeading = Object.fromEntries(privacy.sections.map((s) => [s.heading, s.body]));

    expect(privacy.updated).toBe("21 de octubre de 2026");

    expect(bodyByHeading["Información que recopilamos"]).toBe(
      "Si creas una cuenta, guardamos tu correo electrónico, un nombre opcional y una contraseña cifrada de forma segura, nunca la contraseña en sí. Si inicias sesión con Google, guardamos el identificador de esa cuenta, los tokens de inicio de sesión que emite y la dirección de tu foto de perfil. Si activas la verificación en dos pasos, guardamos su clave secreta cifrada. También guardamos los anuncios que marcas como favoritos, las alertas que creas con sus criterios de búsqueda (incluida la ubicación que elijas o, si la búsqueda partía de «Tu ubicación», tu ubicación aproximada), tu idioma para enviarte los correos en él y, por cada sesión iniciada, la dirección IP y el navegador desde los que se abrió, para que puedas ver y cerrar tus sesiones desde la página de tu cuenta. No guardamos un historial de tus búsquedas. Para proteger el servicio frente a abusos, tratamos tu dirección IP y, cuando inicias sesión o pides restablecer la contraseña, tu correo electrónico.",
    );

    expect(bodyByHeading["Cómo usamos tus datos"]).toBe(
      "Usamos tus datos para prestar el servicio: autenticarte, mantener tu sesión, conservar tus favoritos y alertas, enviarte los correos de la cuenta y de las alertas, proteger el servicio frente a abusos y mejorar el funcionamiento de BuyCarMap. No vendemos tus datos personales.",
    );

    // FRONT-27 amendment: the Cookies section no longer names the theme.
    expect(bodyByHeading.Cookies).not.toContain(
      "El tema que eliges se guarda en el almacenamiento local de tu navegador, no en una cookie.",
    );
    expect(bodyByHeading.Cookies).toMatch(
      /^Usamos solo las cookies que la aplicación necesita para funcionar:.*No usamos cookies publicitarias ni de analítica\.$/,
    );

    expect(bodyByHeading["Servicios de terceros"]).toBe(
      "Nos apoyamos en estos proveedores externos, y cada uno recibe solo lo que necesita: Neon (alojamiento de la base de datos) almacena todo lo que guardamos; Vercel (alojamiento) recibe cada petición, incluida tu dirección IP; Resend (envío de correo) recibe tu correo electrónico y el contenido de los correos que te enviamos; Google (inicio de sesión) recibe tu solicitud de acceso, solo si decides entrar con Google; Have I Been Pwned (comprobación de contraseñas filtradas) recibe los cinco primeros caracteres de un hash irreversible de una contraseña nueva, nunca la contraseña; Upstash (protección frente a abusos) recibe tu dirección IP y un hash irreversible de tu correo electrónico, que se conservan como máximo una hora; Sentry (informes de errores) recibe datos técnicos de los errores, sin cookies, sin tu dirección IP y sin datos de tu cuenta; OpenStreetMap / Nominatim (búsqueda de lugares) recibe el lugar que escribes, directamente desde tu navegador; OpenFreeMap (teselas del mapa) recibe las peticiones de teselas directamente desde tu navegador, que revelan la zona que estás viendo; Wallapop (anuncios) recibe tus filtros de búsqueda y las coordenadas de la búsqueda: la ubicación que elegiste, la posición de tu navegador o el centro de España; coches.net y Milanuncios (anuncios) reciben tus filtros de búsqueda. Las peticiones a Wallapop, coches.net y Milanuncios las hace nuestro servidor, así que ven su dirección, no la tuya. El tratamiento que hagan de los datos se rige por sus propias políticas de privacidad.",
    );

    expect(bodyByHeading["Conservación de datos"]).toBe(
      "Conservamos los datos de tu cuenta, tus favoritos y tus alertas mientras tu cuenta esté activa. Un favorito o una alerta que eliminas se borra 30 días después. Cuando eliminas tu cuenta, sus datos se borran en ese momento, salvo los criterios de búsqueda de una alerta que también usa la alerta de otro usuario: se conservan, ya sin vínculo contigo, hasta que ninguna alerta los use. Las altas pendientes de confirmar, los enlaces de restablecimiento y de confirmación y los registros de protección frente a abusos se borran después de caducar.",
    );

    expect(bodyByHeading.Ubicación).toBe(
      "Para centrar el mapa en ti, podemos pedir a tu navegador tu ubicación. Se usa para centrar el mapa y buscar cerca de ti, así que nuestro servidor envía sus coordenadas a Wallapop junto con tu búsqueda. Nunca se guarda en nuestros servidores salvo que la guardes como parte de una alerta. Puedes no permitirlo y usaremos el centro de España.",
    );
  });
});

// docs/specs/redesign-pages.md (PAGES-61, PAGES-62, PAGES-63, PAGES-74). The
// design gives Spanish copy only (English is drafted with the implementation,
// reviewed in the PR), so the new short titles «Privacidad» / «Términos» and
// «En esta página» are asserted in Spanish, not against the existing
// English-locale tests above, whose titles ("Privacy Policy" / "Terms of
// Service") this spec does not fix an English replacement for.
describe("PAGES-61: the legal pages' structure", () => {
  it("PAGES-61: /terms's h1 is «Términos», followed by «Última actualización:», in Spanish", () => {
    renderWithI18n(<LegalContent doc="terms" />, { locale: "es" });

    expect(screen.getByRole("heading", { level: 1, name: "Términos" })).toBeInTheDocument();
    expect(screen.getByText(/^Última actualización:/)).toBeInTheDocument();
  });

  it("PAGES-61: /privacy's h1 is «Privacidad», in Spanish", () => {
    renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

    expect(screen.getByRole("heading", { level: 1, name: "Privacidad" })).toBeInTheDocument();
  });

  it("PAGES-61: shows no «Volver al inicio» link", () => {
    renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

    expect(screen.queryByRole("link", { name: "Volver al inicio" })).not.toBeInTheDocument();
    expect(screen.queryByText("Volver al inicio")).not.toBeInTheDocument();
  });

  it("PAGES-61: each section's heading is an h2 that carries its own non-empty id", () => {
    renderWithI18n(<LegalContent doc="privacy" />);

    const headings = screen.getAllByRole("heading", { level: 2 });
    // A guard on the guard: with no h2 found the loop below passes
    // vacuously and this test would defend nothing at all.
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      expect(heading, `"${heading.textContent}" has an id attribute`).toHaveAttribute("id");
      expect(heading.id, `"${heading.textContent}"'s id is not empty`).not.toBe("");
    }
  });
});

describe("PAGES-62: the desktop index", () => {
  it("PAGES-62: shows a navigation region «En esta página» with one link per section, in the page's order, each to \"#\" + its heading's id", () => {
    renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

    const nav = screen.getByRole("navigation", { name: "En esta página" });
    const headings = screen.getAllByRole("heading", { level: 2 });
    const links = within(nav).getAllByRole("link");

    expect(links).toHaveLength(headings.length);
    links.forEach((link, index) => {
      expect(link).toHaveAttribute("href", `#${headings[index].id}`);
      expect(link).toHaveTextContent(headings[index].textContent ?? "");
    });
  });

  it("PAGES-62: on load only the first section is current", () => {
    // jsdom lays nothing out: draw the headings 400px apart, the first 100px
    // under the top of the scrolling box, past the reading line.
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      const index = Array.from(document.querySelectorAll("h2[id]")).indexOf(this);
      const top = index < 0 ? 0 : 100 + index * 400;
      return {
        top,
        bottom: top,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: top,
        toJSON: () => ({}),
      };
    });
    renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

    const nav = screen.getByRole("navigation", { name: "En esta página" });
    const links = within(nav).getAllByRole("link");
    const current = links.filter((link) => link.getAttribute("aria-current") === "location");

    expect(current).toEqual([links[0]]);
    rect.mockRestore();
  });
});

describe("PAGES-63: the phone index", () => {
  it("PAGES-63: the collapsed index is a button «En esta página» with aria-expanded false, that opens the list on press", async () => {
    renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

    const toggle = screen.getByRole("button", { name: "En esta página" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("PAGES-63: pressing a section in the open index scrolls to its heading and folds the index", async () => {
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);
    renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

    const toggle = screen.getByRole("button", { name: "En esta página" });
    await userEvent.click(toggle);
    const firstHeading = screen.getAllByRole("heading", { level: 2 })[0];
    const sectionLink = screen.getByRole("link", { name: firstHeading.textContent ?? "" });

    await userEvent.click(sectionLink);

    expect(scrollIntoView).toHaveBeenCalled();
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    scrollIntoView.mockRestore();
  });

  describe("at phone width", () => {
    afterEach(() => {
      restoreMatchMedia();
      window.history.replaceState(null, "", "/");
    });

    it("PAGES-63: pressing «Cookies» folds the index first, then scrolls to #cookies and names it in the address", async () => {
      stubPhoneWidth();
      const scrolled: { id: string; listShown: boolean }[] = [];
      const scrollIntoView = vi
        .spyOn(Element.prototype, "scrollIntoView")
        .mockImplementation(function (this: Element) {
          scrolled.push({
            id: this.id,
            listShown: screen.queryByRole("link", { name: "Cookies" }) !== null,
          });
        });
      renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

      const toggle = screen.getByRole("button", { name: "En esta página" });
      await userEvent.click(toggle);
      await userEvent.click(await screen.findByRole("link", { name: "Cookies" }));

      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await waitFor(() => expect(scrolled).toEqual([{ id: "cookies", listShown: false }]));
      expect(window.location.hash).toBe("#cookies");

      scrollIntoView.mockRestore();
    });

    it("PAGES-63 (bug fix, #137): on a busy page, pressing «Cookies» scrolls only once the folded list is gone", async () => {
      stubPhoneWidth();
      const scrolled: { id: string; listShown: boolean }[] = [];
      const scrollIntoView = vi
        .spyOn(Element.prototype, "scrollIntoView")
        .mockImplementation(function (this: Element) {
          scrolled.push({
            id: this.id,
            listShown: screen.queryByRole("link", { name: "Cookies" }) !== null,
          });
        });
      onTestFinished(() => scrollIntoView.mockRestore());
      renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

      const toggle = screen.getByRole("button", { name: "En esta página" });
      await userEvent.click(toggle);
      const cookies = await screen.findByRole("link", { name: "Cookies" });
      // A busy page: the press takes longer than a frame, so the next frame is
      // already due when its handlers finish, and a frame callback runs before
      // React's next render. jsdom only gets there when its 60 Hz timer happens
      // to line up with the press; running each callback as soon as the
      // current task ends gives that ordering on every run.
      const frameAlreadyDue = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((callback) => {
          queueMicrotask(() => callback(performance.now()));
          return 0;
        });
      onTestFinished(() => frameAlreadyDue.mockRestore());
      await userEvent.click(cookies);

      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await waitFor(() => expect(scrolled).toEqual([{ id: "cookies", listShown: false }]));
      expect(window.location.hash).toBe("#cookies");
    });

    it("PAGES-63: pressing «Cookies» a second time after reopening the index scrolls to #cookies again", async () => {
      stubPhoneWidth();
      const scrolled: { id: string; listShown: boolean }[] = [];
      const scrollIntoView = vi
        .spyOn(Element.prototype, "scrollIntoView")
        .mockImplementation(function (this: Element) {
          scrolled.push({
            id: this.id,
            listShown: screen.queryByRole("link", { name: "Cookies" }) !== null,
          });
        });
      onTestFinished(() => scrollIntoView.mockRestore());
      renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

      const toggle = screen.getByRole("button", { name: "En esta página" });
      await userEvent.click(toggle);
      await userEvent.click(await screen.findByRole("link", { name: "Cookies" }));
      await waitFor(() => expect(scrolled).toHaveLength(1));

      await userEvent.click(toggle);
      await userEvent.click(await screen.findByRole("link", { name: "Cookies" }));

      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await waitFor(() =>
        expect(scrolled).toEqual([
          { id: "cookies", listShown: false },
          { id: "cookies", listShown: false },
        ]),
      );
      expect(window.location.hash).toBe("#cookies");
    });
  });
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-15: the phone index
// folds at once when a section is chosen with Enter or Space, and the page
// still jumps to that section (PAGES-63). Chosen with a pointer, it folds
// over the state transition first, then jumps.
describe("MOTION-15: LegalContent — the phone index folds at once from the keyboard, but still over the state transition for a pointer", () => {
  afterEach(() => {
    restoreMatchMedia();
    window.history.replaceState(null, "", "/");
  });

  it("MOTION-15: Enter on a section link folds the index and jumps to its heading in the same tick, even with animations enabled", async () => {
    await withAnimations(async () => {
      stubPhoneWidth();
      const scrollIntoView = vi
        .spyOn(Element.prototype, "scrollIntoView")
        .mockImplementation(() => undefined);
      renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

      const toggle = screen.getByRole("button", { name: "En esta página" });
      await userEvent.click(toggle);
      const cookies = await screen.findByRole("link", { name: "Cookies" });
      cookies.focus();

      await userEvent.keyboard("{Enter}");

      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("link", { name: "Cookies" })).not.toBeInTheDocument();
      expect(scrollIntoView).toHaveBeenCalled();
      expect(window.location.hash).toBe("#cookies");

      scrollIntoView.mockRestore();
    });
  });

  it("MOTION-15: a click on a section link still folds the index first — it is still mounted right after the click, and the jump waits for its exit", async () => {
    await withAnimations(async (clock) => {
      stubPhoneWidth();
      const scrollIntoView = vi
        .spyOn(Element.prototype, "scrollIntoView")
        .mockImplementation(() => undefined);
      renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

      const toggle = screen.getByRole("button", { name: "En esta página" });
      await userEvent.click(toggle);
      const cookies = await screen.findByRole("link", { name: "Cookies" });
      // The index has slid in whole: a fold from opacity 0 would end at once.
      await clock.finish();

      await userEvent.click(cookies);

      expect(screen.getByRole("link", { name: "Cookies" })).toBeInTheDocument();
      expect(scrollIntoView).not.toHaveBeenCalled();
      await clock.finish();
      await waitFor(() =>
        expect(screen.queryByRole("link", { name: "Cookies" })).not.toBeInTheDocument(),
      );
      expect(scrollIntoView).toHaveBeenCalled();

      scrollIntoView.mockRestore();
    });
  });
});

interface LegalSection {
  id?: string;
  heading: string;
}
interface LegalMessages {
  legal: {
    privacy: { sections: LegalSection[] };
    terms: { sections: LegalSection[] };
  };
}

// docs/specs/motion.md (MOTION-17): the «En esta página» toggle gains a hover
// and a press state, in the state transition.
describe("MOTION-17: LegalContent — hover and press on the index toggle", () => {
  it("MOTION-17: «En esta página» carries hover:bg-surface-strong and active:scale-97, off under reduced motion", () => {
    renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

    const className = screen.getByRole("button", { name: "En esta página" }).className;
    expect(className).toContain("hover:bg-surface-strong");
    expect(className).toContain("active:scale-97");
    expect(className).toContain("motion-reduce:active:scale-none");
    expect(className).toMatch(/transition-\[[^\]]+\]/);
  });
});

describe("PAGES-74: legal section ids", () => {
  it("PAGES-74: every privacy and terms section has its own non-empty id, unique within its page", () => {
    const en = enMessages as LegalMessages;

    for (const doc of ["privacy", "terms"] as const) {
      const ids = en.legal[doc].sections.map((section) => section.id);
      expect(
        ids.every((id) => typeof id === "string" && id.length > 0),
        `${doc}'s sections all have a non-empty id: ${JSON.stringify(ids)}`,
      ).toBe(true);
      expect(new Set(ids).size, `${doc}'s ids are unique`).toBe(ids.length);
    }
  });

  it("PAGES-74: each section's id is the same in messages/es.json and messages/en.json", () => {
    const en = enMessages as LegalMessages;
    const es = esMessages as LegalMessages;

    for (const doc of ["privacy", "terms"] as const) {
      expect(es.legal[doc].sections.map((section) => section.id)).toEqual(
        en.legal[doc].sections.map((section) => section.id),
      );
    }
  });

  it.each(["privacy", "terms"] as const)(
    "PAGES-74: the rendered %s h2 ids are the message file's ids, in order, the same in both locales",
    (doc) => {
      const es = esMessages as LegalMessages;
      const expected = es.legal[doc].sections.map((section) => section.id);

      for (const locale of ["es", "en"] as const) {
        const { unmount } = renderWithI18n(<LegalContent doc={doc} />, { locale });
        const ids = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.id);
        expect(ids, locale).toEqual(expected);
        unmount();
      }
    },
  );

  it("PAGES-61: /privacy's intro follows «Última actualización:», in Spanish", () => {
    renderWithI18n(<LegalContent doc="privacy" />, { locale: "es" });

    const updated = screen.getByText(/^Última actualización:/);
    const intro = screen.getByText(
      "Esta política explica qué datos recopila BuyCarMap, por qué y qué puedes hacer al respecto. Intentamos recopilar los mínimos posibles.",
    );
    expect(updated.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
