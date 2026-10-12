import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { LegalContent } from "./LegalContent";
import esMessages from "@/messages/es.json";

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
    expect(screen.getByText("About the service")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it("renders the Privacy document when doc='privacy'", () => {
    renderWithI18n(<LegalContent doc="privacy" />);

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText("Information we collect")).toBeInTheDocument();
  });

  it("selects content by the doc prop and does not leak the other document", () => {
    renderWithI18n(<LegalContent doc="privacy" />);

    // "About the service" is a Terms-only heading; it must not appear here.
    expect(screen.queryByText("About the service")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Terms of Service" })).not.toBeInTheDocument();
  });

  it("FRONT-27: renders the English privacy copy from the spec's worked example word for word (amended 2026-10-12, LOOK — redesign-foundation.md)", () => {
    renderWithI18n(<LegalContent doc="privacy" />);

    expect(screen.getByText("Last updated: 11 October 2026")).toBeInTheDocument();

    // FRONT-27 amendment: the Cookies section no longer names the theme —
    // there is nothing left to keep in local storage.
    expect(
      screen.queryByText(
        /Your theme choice is kept in your browser's local storage, not in a cookie\.?/,
      ),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(
        "If you create an account, we store your email address, an optional display name, and a securely hashed password — never the password itself. If you sign in with Google or GitHub, we store the identifier of that account, the sign-in tokens it issues and the address of your profile picture. If you turn on two-factor authentication, we store its secret in encrypted form. We also store the listings you save as favourites, the alerts you create with their search criteria (including any location you chose), your language so emails reach you in it, and, for each signed-in session, the IP address and browser it came from, so you can see and end your sessions from your account page. We do not keep a history of your searches. To protect the service from abuse, we process your IP address and, when you sign in or ask for a password reset, your email address.",
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
        "We rely on these external providers, and each receives only what it needs: Neon (database hosting) stores everything we keep; Vercel (hosting) receives every request, including your IP address; Resend (email delivery) receives your email address and the content of the emails we send you; Google and GitHub (sign-in) receive your sign-in request, only if you choose to sign in with them; Have I Been Pwned (leaked-password check) receives the first five characters of a one-way hash of a new password, never the password itself; Upstash (abuse protection) receives your IP address and a one-way hash of your email address, kept for at most one hour; Sentry (error reports) receives technical details of errors, without cookies, your IP address or your account details; OpenStreetMap / Nominatim (place search) receives the place you type, straight from your browser; CARTO (map tiles) receives tile requests straight from your browser, which show the area you are viewing; Wallapop (listings) receives your search filters and the coordinates of the search: the location you chose, your browser's position, or the centre of Spain; coches.net and Milanuncios (listings) receive your search filters. Our server sends the requests to Wallapop, coches.net and Milanuncios, so they see its address, not yours. Their handling of any data is governed by their own privacy policies.",
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

    expect(privacy.updated).toBe("11 de octubre de 2026");

    expect(bodyByHeading["Información que recopilamos"]).toBe(
      "Si creas una cuenta, guardamos tu correo electrónico, un nombre opcional y una contraseña cifrada de forma segura, nunca la contraseña en sí. Si inicias sesión con Google o GitHub, guardamos el identificador de esa cuenta, los tokens de inicio de sesión que emite y la dirección de tu foto de perfil. Si activas la verificación en dos pasos, guardamos su clave secreta cifrada. También guardamos los anuncios que marcas como favoritos, las alertas que creas con sus criterios de búsqueda (incluida la ubicación que elijas), tu idioma para enviarte los correos en él y, por cada sesión iniciada, la dirección IP y el navegador desde los que se abrió, para que puedas ver y cerrar tus sesiones desde la página de tu cuenta. No guardamos un historial de tus búsquedas. Para proteger el servicio frente a abusos, tratamos tu dirección IP y, cuando inicias sesión o pides restablecer la contraseña, tu correo electrónico.",
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
      "Nos apoyamos en estos proveedores externos, y cada uno recibe solo lo que necesita: Neon (alojamiento de la base de datos) almacena todo lo que guardamos; Vercel (alojamiento) recibe cada petición, incluida tu dirección IP; Resend (envío de correo) recibe tu correo electrónico y el contenido de los correos que te enviamos; Google y GitHub (inicio de sesión) reciben tu solicitud de acceso, solo si decides entrar con ellos; Have I Been Pwned (comprobación de contraseñas filtradas) recibe los cinco primeros caracteres de un hash irreversible de una contraseña nueva, nunca la contraseña; Upstash (protección frente a abusos) recibe tu dirección IP y un hash irreversible de tu correo electrónico, que se conservan como máximo una hora; Sentry (informes de errores) recibe datos técnicos de los errores, sin cookies, sin tu dirección IP y sin datos de tu cuenta; OpenStreetMap / Nominatim (búsqueda de lugares) recibe el lugar que escribes, directamente desde tu navegador; CARTO (teselas del mapa) recibe las peticiones de teselas directamente desde tu navegador, que revelan la zona que estás viendo; Wallapop (anuncios) recibe tus filtros de búsqueda y las coordenadas de la búsqueda: la ubicación que elegiste, la posición de tu navegador o el centro de España; coches.net y Milanuncios (anuncios) reciben tus filtros de búsqueda. Las peticiones a Wallapop, coches.net y Milanuncios las hace nuestro servidor, así que ven su dirección, no la tuya. El tratamiento que hagan de los datos se rige por sus propias políticas de privacidad.",
    );

    expect(bodyByHeading["Conservación de datos"]).toBe(
      "Conservamos los datos de tu cuenta, tus favoritos y tus alertas mientras tu cuenta esté activa. Un favorito o una alerta que eliminas se borra 30 días después. Cuando eliminas tu cuenta, sus datos se borran en ese momento, salvo los criterios de búsqueda de una alerta que también usa la alerta de otro usuario: se conservan, ya sin vínculo contigo, hasta que ninguna alerta los use. Las altas pendientes de confirmar, los enlaces de restablecimiento y de confirmación y los registros de protección frente a abusos se borran después de caducar.",
    );

    expect(bodyByHeading.Ubicación).toBe(
      "Para centrar el mapa en ti, podemos pedir a tu navegador tu ubicación. Se usa para centrar el mapa y buscar cerca de ti, así que nuestro servidor envía sus coordenadas a Wallapop junto con tu búsqueda. Nunca se guarda en nuestros servidores salvo que la guardes como parte de una alerta. Puedes no permitirlo y usaremos el centro de España.",
    );
  });
});
