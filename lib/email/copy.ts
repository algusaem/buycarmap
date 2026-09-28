import type { Locale } from "@/lib/i18n/config";

// Email copy lives here rather than in lib/i18n/locales/*, because those are
// consumed through the client `useTranslation` hook (React context) and emails
// render on the server with no context available. Keeping them separate also
// keeps email-only prose out of the client bundle.

interface ResetCopy {
  subject: string;
  heading: string;
  intro: string;
  button: string;
  expiry: string;
  ignore: string;
  fallback: string;
}

interface NoticeCopy {
  subject: string;
  heading: string;
  intro: string;
  action: string;
}

interface ExistingAccountCopy {
  subject: string;
  heading: string;
  intro: string;
  button: string;
  ignore: string;
  fallback: string;
}

export interface EmailCopy {
  passwordReset: ResetCopy;
  passwordChanged: NoticeCopy;
  existingAccount: ExistingAccountCopy;
  verifyRegistration: ResetCopy;
  verifyEmailAddress: ResetCopy;
  emailChange: ResetCopy;
  emailChangedNotice: NoticeCopy;
  footer: string;
}

export const emailCopy: Record<Locale, EmailCopy> = {
  en: {
    passwordReset: {
      subject: "Reset your BuyCarMap password",
      heading: "Reset your password",
      intro:
        "We received a request to set a new password for your BuyCarMap account. Click the button below to choose one.",
      button: "Choose a new password",
      expiry: "This link expires in one hour and can only be used once.",
      ignore:
        "If you didn't request this, you can safely ignore this email — your password will not change.",
      fallback: "If the button doesn't work, paste this link into your browser:",
    },
    passwordChanged: {
      subject: "Your BuyCarMap password was changed",
      heading: "Your password was changed",
      intro:
        "The password for your BuyCarMap account was just changed. You have been signed out on all other devices.",
      action: "If this wasn't you, reset your password immediately and contact us.",
    },
    existingAccount: {
      subject: "Someone tried to sign up with your email",
      heading: "You already have an account",
      intro:
        "Someone just tried to create a BuyCarMap account with this email address. An account already exists, so nothing was created.",
      button: "Sign in instead",
      ignore:
        "If this was you and you've forgotten your password, use the reset link on the sign-in page.",
      fallback: "If the button doesn't work, paste this link into your browser:",
    },
    verifyRegistration: {
      subject: "Confirm your BuyCarMap account",
      heading: "Confirm your account",
      intro:
        "Someone — hopefully you — signed up for BuyCarMap with this email address. Confirm below to finish creating your account.",
      button: "Confirm my account",
      expiry: "This link expires in 24 hours and can only be used once.",
      ignore:
        "If you didn't sign up, you can safely ignore this email. No account has been created.",
      fallback: "If the button doesn't work, paste this link into your browser:",
    },
    verifyEmailAddress: {
      subject: "Verify your BuyCarMap email address",
      heading: "Verify your email address",
      intro:
        "Confirm this address so we can reach you about your account — for example if you ever need to reset your password.",
      button: "Verify my email",
      expiry: "This link expires in 24 hours and can only be used once.",
      ignore: "If you didn't request this, you can safely ignore this email. Nothing will change.",
      fallback: "If the button doesn't work, paste this link into your browser:",
    },
    emailChange: {
      subject: "Confirm your new BuyCarMap email address",
      heading: "Confirm your new address",
      intro:
        "A request was made to move a BuyCarMap account to this email address. Confirm below to complete the change.",
      button: "Confirm this address",
      expiry: "This link expires in 24 hours and can only be used once.",
      ignore:
        "If you weren't expecting this, ignore this email. Nothing will change and no account will be moved to this address.",
      fallback: "If the button doesn't work, paste this link into your browser:",
    },
    emailChangedNotice: {
      subject: "Your BuyCarMap email address was changed",
      heading: "Your email address was changed",
      intro:
        "The email address on your BuyCarMap account was changed to a different one. You are receiving this at your previous address so you know it happened.",
      action:
        "If this wasn't you, someone may have access to your account. Reset your password immediately and contact us.",
    },
    footer: "BuyCarMap — second-hand cars on a map",
  },
  es: {
    passwordReset: {
      subject: "Restablece tu contraseña de BuyCarMap",
      heading: "Restablece tu contraseña",
      intro:
        "Hemos recibido una solicitud para establecer una nueva contraseña en tu cuenta de BuyCarMap. Pulsa el botón para elegir una.",
      button: "Elegir una nueva contraseña",
      expiry: "Este enlace caduca en una hora y solo puede usarse una vez.",
      ignore: "Si no has sido tú, puedes ignorar este correo: tu contraseña no cambiará.",
      fallback: "Si el botón no funciona, pega este enlace en tu navegador:",
    },
    passwordChanged: {
      subject: "Se ha cambiado tu contraseña de BuyCarMap",
      heading: "Tu contraseña ha cambiado",
      intro:
        "La contraseña de tu cuenta de BuyCarMap acaba de cambiar. Se ha cerrado la sesión en el resto de dispositivos.",
      action: "Si no has sido tú, restablece tu contraseña de inmediato y contacta con nosotros.",
    },
    existingAccount: {
      subject: "Alguien ha intentado registrarse con tu correo",
      heading: "Ya tienes una cuenta",
      intro:
        "Alguien acaba de intentar crear una cuenta de BuyCarMap con esta dirección de correo. Ya existe una cuenta, así que no se ha creado nada.",
      button: "Iniciar sesión",
      ignore:
        "Si has sido tú y has olvidado tu contraseña, usa el enlace de recuperación en la página de inicio de sesión.",
      fallback: "Si el botón no funciona, pega este enlace en tu navegador:",
    },
    verifyRegistration: {
      subject: "Confirma tu cuenta de BuyCarMap",
      heading: "Confirma tu cuenta",
      intro:
        "Alguien —esperamos que tú— se ha registrado en BuyCarMap con esta dirección de correo. Confirma abajo para terminar de crear tu cuenta.",
      button: "Confirmar mi cuenta",
      expiry: "Este enlace caduca en 24 horas y solo puede usarse una vez.",
      ignore: "Si no has sido tú, puedes ignorar este correo. No se ha creado ninguna cuenta.",
      fallback: "Si el botón no funciona, pega este enlace en tu navegador:",
    },
    verifyEmailAddress: {
      subject: "Verifica tu correo de BuyCarMap",
      heading: "Verifica tu dirección de correo",
      intro:
        "Confirma esta dirección para que podamos contactarte sobre tu cuenta, por ejemplo si alguna vez necesitas restablecer tu contraseña.",
      button: "Verificar mi correo",
      expiry: "Este enlace caduca en 24 horas y solo puede usarse una vez.",
      ignore: "Si no has solicitado esto, puedes ignorar este correo. No cambiará nada.",
      fallback: "Si el botón no funciona, pega este enlace en tu navegador:",
    },
    emailChange: {
      subject: "Confirma tu nueva dirección de BuyCarMap",
      heading: "Confirma tu nueva dirección",
      intro:
        "Se ha solicitado mover una cuenta de BuyCarMap a esta dirección de correo. Confirma abajo para completar el cambio.",
      button: "Confirmar esta dirección",
      expiry: "Este enlace caduca en 24 horas y solo puede usarse una vez.",
      ignore:
        "Si no esperabas esto, ignora este correo. No cambiará nada ni se moverá ninguna cuenta a esta dirección.",
      fallback: "Si el botón no funciona, pega este enlace en tu navegador:",
    },
    emailChangedNotice: {
      subject: "Se ha cambiado el correo de tu cuenta de BuyCarMap",
      heading: "Tu dirección de correo ha cambiado",
      intro:
        "La dirección de correo de tu cuenta de BuyCarMap se ha cambiado por otra. Recibes este aviso en tu dirección anterior para que sepas que ha ocurrido.",
      action:
        "Si no has sido tú, es posible que alguien tenga acceso a tu cuenta. Restablece tu contraseña de inmediato y contacta con nosotros.",
    },
    footer: "BuyCarMap — coches de segunda mano en un mapa",
  },
};
