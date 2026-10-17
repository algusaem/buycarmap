// docs/specs/redesign-pages.md (PAGES-25 to PAGES-60, PAGES-71 to PAGES-73):
// fixtures for the redesigned /account — the page's props, its worked
// examples ("Summary line", "Sessions line", "Device", "Account query") as
// builders, and the Spanish copy the tests read. Pure data, no vitest. The
// props are AccountPage's own (components/account/AccountPage.tsx): the page
// query's fields (PAGES-60) with `hasPassword` rather than the hash and each
// session marked `current` by app/account/page.tsx.

import type { AccountPageProps } from "@/components/account/AccountPage";

/** Chrome on Windows (worked example "Device" and "Sessions line"). */
const UA_CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";
/** Safari on an iPhone (worked example "Device" and "Sessions line"). */
const UA_SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1";
/** Today, per the worked examples ("Summary line"): 2026-10-16. */
const TODAY = new Date("2026-10-16T12:00:00.000Z");

/** `F0-cuenta`'s own row (Alba): 8 saved, 3 alerts, since March 2026, this device alone. */
export function albaAccount(overrides: Partial<AccountPageProps> = {}): AccountPageProps {
  return {
    name: "Alba",
    email: "alba@example.com",
    emailConfirmed: true,
    hasPassword: true,
    twoFactorEnabled: false,
    version: 1,
    createdAt: new Date("2026-03-10T10:00:00.000Z"),
    providers: [],
    favoritesCount: 8,
    alertsCount: 3,
    sessions: [
      { id: "session-this", userAgent: UA_CHROME_WINDOWS, lastUsedAt: TODAY, current: true },
    ],
    ...overrides,
  };
}

/** This device plus Safari on an iPhone, last used 2 days ago (worked example "Sessions line"). */
export function albaWithTwoSessions(): AccountPageProps {
  return albaAccount({
    sessions: [
      { id: "session-this", userAgent: UA_CHROME_WINDOWS, lastUsedAt: TODAY, current: true },
      {
        id: "session-iphone",
        userAgent: UA_SAFARI_IPHONE,
        lastUsedAt: new Date("2026-10-14T12:00:00.000Z"),
        current: false,
      },
    ],
  });
}

/** The two above plus three older sessions (worked example "Sessions line", "y 3 más"). */
export function albaWithFiveSessions(): AccountPageProps {
  const two = albaWithTwoSessions();
  return albaAccount({
    sessions: [
      ...two.sessions,
      {
        id: "session-old-1",
        userAgent: "",
        lastUsedAt: new Date("2026-10-01T12:00:00Z"),
        current: false,
      },
      {
        id: "session-old-2",
        userAgent: "",
        lastUsedAt: new Date("2026-09-20T12:00:00Z"),
        current: false,
      },
      {
        id: "session-old-3",
        userAgent: "",
        lastUsedAt: new Date("2026-09-01T12:00:00Z"),
        current: false,
      },
    ],
  });
}

/** A Google-only account: no password, no two-factor, Google linked (PAGES-27, PAGES-34). */
export function googleOnlyAccount(): AccountPageProps {
  return albaAccount({ hasPassword: false, providers: ["google"], twoFactorEnabled: false });
}

/** Worked example "Summary line": saved/alerts/createdAt/timeZone → the summary line. */
export const SUMMARY_LINE_CASES = [
  {
    saved: 8,
    alerts: 3,
    createdAt: "2026-03-10T10:00:00Z",
    timeZone: "UTC",
    line: "8 guardados · 3 alertas · en BuyCarMap desde marzo",
  },
  {
    saved: 0,
    alerts: 0,
    createdAt: "2026-03-10T10:00:00Z",
    timeZone: "UTC",
    line: "0 guardados · 0 alertas · en BuyCarMap desde marzo",
  },
  {
    saved: 1,
    alerts: 1,
    createdAt: "2026-03-10T10:00:00Z",
    timeZone: "UTC",
    line: "1 guardado · 1 alerta · en BuyCarMap desde marzo",
  },
  {
    saved: 2,
    alerts: 1,
    createdAt: "2025-03-10T10:00:00Z",
    timeZone: "UTC",
    line: "2 guardados · 1 alerta · en BuyCarMap desde marzo de 2025",
  },
  {
    saved: 8,
    alerts: 3,
    createdAt: "2025-03-31T23:30:00Z",
    timeZone: "UTC",
    line: "8 guardados · 3 alertas · en BuyCarMap desde marzo de 2025",
  },
  {
    saved: 8,
    alerts: 3,
    createdAt: "2025-03-31T23:30:00Z",
    timeZone: "Europe/Madrid",
    line: "8 guardados · 3 alertas · en BuyCarMap desde abril de 2025",
  },
  {
    saved: 8,
    alerts: 3,
    createdAt: "2025-12-31T23:30:00Z",
    timeZone: "UTC",
    line: "8 guardados · 3 alertas · en BuyCarMap desde diciembre de 2025",
  },
  {
    saved: 8,
    alerts: 3,
    createdAt: "2025-12-31T23:30:00Z",
    timeZone: "Europe/Madrid",
    line: "8 guardados · 3 alertas · en BuyCarMap desde enero",
  },
] as const;

/** The copy the worked examples and criteria quote verbatim, in Spanish (the default locale). */
export const ACCOUNT_COPY = {
  heading: "Cuenta",
  descriptionDesktop: "Tus datos, tus reglas. Cambia lo que quieras cuando quieras.",
  descriptionPhone: "Tus datos, tus reglas.",
  signOut: "Cerrar sesión",
  changeName: "Cambiar nombre",
  changeEmail: "Cambiar correo",
  changePassword: "Cambiar contraseña",
  savePassword: "Guardar contraseña",
  manage: "Gestionar",
  activate: "Activar",
  close: "Cerrar",
  cancel: "Cancelar",
  deleteAccountQuestion: "¿Eliminar tu cuenta?",
  deleteAccountCta: "Eliminar mi cuenta",
  saveChanges: "Guardar cambios",
  verified: "Verificado",
  unverified: "Sin verificar",
  sendVerification: "Enviar correo de verificación",
  twoFactorOn: "Activada",
  twoFactorOff: "Desactivada",
  connected: "Conectada",
  disconnect: "Desconectar",
  closeOthers: "Cerrar las demás",
  downloadData: "Descargar mis datos",
  configureTwoFactor: "Configurar dos pasos",
  activateTwoFactor: "Activar dos pasos",
  copyCodes: "Copiar códigos",
  codesSaved: "Ya los he guardado",
  regenerateCodes: "Generar códigos nuevos",
  disableTwoFactor: "Desactivar dos pasos",
  signOutSession: "Cerrar sesión",
  signOutEverywhere: "Cerrar sesión en todas partes",
  retry: "Reintentar",
  profileUpdated: "Perfil actualizado",
  passwordUpdated: "Contraseña actualizada",
  verificationSent: "Correo de verificación enviado. Revisa tu bandeja",
  codesCopied: "Copiado al portapapeles",
  copyFailed:
    "No se ha podido copiar automáticamente. Selecciona los códigos de arriba y cópialos a mano.",
  twoFactorEnabledToast: "Verificación en dos pasos activada",
  twoFactorDisabledToast: "Verificación en dos pasos desactivada",
  othersSignedOutToast: "Se ha cerrado la sesión en todos los demás dispositivos",
  accountDisconnectedToast: "Cuenta desconectada",
  accountDeletedToast: "Tu cuenta ha sido eliminada",
  currentPasswordIncorrect: "Tu contraseña actual no es correcta",
  sameEmail: "Esa ya es tu dirección de correo",
  totpInvalid: "Ese código no es válido. Revisa tu app e inténtalo de nuevo.",
  passwordBreached:
    "Esta contraseña ha aparecido en una filtración de datos conocida. Elige otra distinta.",
  passwordWeak:
    "Esta contraseña es demasiado fácil de adivinar. Prueba con una más larga o menos predecible.",
  passwordReused: "Elige una contraseña distinta de la actual",
  emailChangeNotice:
    "Enviaremos un enlace a la nueva dirección. Tu correo solo cambiará cuando lo confirmes allí.",
  emailChangeSent:
    "Si esa dirección está disponible, le hemos enviado un enlace de confirmación. El cambio se aplica cuando lo pulses allí.",
  lastSignInMethodLine: "Es tu única forma de iniciar sesión.",
  lastSignInMethodError: "No puedes desconectarla: es tu única forma de iniciar sesión.",
  sessionsLoadError: "No se han podido cargar tus sesiones.",
  deleteWarning: "Borra tu cuenta, tus guardados y tus alertas para siempre. No hay vuelta atrás.",
  deleteConfirmHint: "Escribe ELIMINAR en mayúsculas para activar el botón.",
} as const;
