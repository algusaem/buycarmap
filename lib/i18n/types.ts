export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDocument {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export interface Translations {
  common: {
    search: string;
    popular: string;
    or: string;
  };
  hero: {
    title: string;
    titleHighlight: string;
    subtitle: string;
    searchPlaceholder: string;
    exploreMap: string;
    signInToSave: string;
    stats: {
      listings: string;
      platforms: string;
      free: string;
    };
  };
  auth: {
    welcomeBack: string;
    signInDescription: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    forgotPassword: string;
    signIn: string;
    signingIn: string;
    noAccount: string;
    createOne: string;
    continueWithGoogle: string;
    continueWithGithub: string;
    invalidCredentials: string;
    createAccount: string;
    signUpDescription: string;
    name: string;
    namePlaceholder: string;
    confirmPassword: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    signUp: string;
    creatingAccount: string;
    alreadyHaveAccount: string;
    registrationFailed: string;
    signInSuccess: string;
    accountCreated: string;
    legalNotice: string;
    terms: string;
    and: string;
    privacyPolicy: string;
    brandTagline: string;
    return: string;
  };
  forgotPassword: {
    title: string;
    description: string;
    submit: string;
    submitting: string;
    backToLogin: string;
    successTitle: string;
    successDescription: string;
    genericError: string;
  };
  verifyEmail: {
    // Shown on /register after submitting, for taken and free addresses alike.
    pendingTitle: string;
    pendingDescription: string;
    title: string;
    description: string;
    submit: string;
    submitting: string;
    success: string;
    successTitle: string;
    successDescription: string;
    signIn: string;
    invalidTitle: string;
    invalidDescription: string;
    backToRegister: string;
    resend: string;
    resending: string;
    resent: string;
  };
  confirmEmail: {
    title: string;
    description: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successDescription: string;
    backToAccount: string;
    invalidTitle: string;
    invalidDescription: string;
  };
  resetPassword: {
    title: string;
    description: string;
    newPassword: string;
    newPasswordPlaceholder: string;
    confirmPassword: string;
    confirmPasswordPlaceholder: string;
    submit: string;
    submitting: string;
    success: string;
    invalidTitle: string;
    invalidDescription: string;
    requestNewLink: string;
    backToLogin: string;
  };
  account: {
    title: string;
    description: string;
    backToMap: string;
    profile: {
      title: string;
      description: string;
      name: string;
      namePlaceholder: string;
      email: string;
      emailHint: string;
      submit: string;
      submitting: string;
      success: string;
    };
    email: {
      title: string;
      description: string;
      current: string;
      verified: string;
      unverified: string;
      verifyCta: string;
      verifying: string;
      verifySent: string;
      newEmail: string;
      newEmailPlaceholder: string;
      currentPassword: string;
      currentPasswordPlaceholder: string;
      submit: string;
      submitting: string;
      submitted: string;
      notice: string;
    };
    sessions: {
      title: string;
      description: string;
      submit: string;
      submitting: string;
      warning: string;
    };
    twoFactor: {
      title: string;
      description: string;
      enabled: string;
      disabled: string;
      unavailable: string;
      enableCta: string;
      starting: string;
      scanTitle: string;
      scanDescription: string;
      manualLabel: string;
      manualHint: string;
      codeLabel: string;
      codePlaceholder: string;
      recoveryHint: string;
      confirm: string;
      confirming: string;
      cancel: string;
      enabledToast: string;
      recoveryTitle: string;
      recoveryDescription: string;
      recoveryWarning: string;
      copyCodes: string;
      copied: string;
      copyFailed: string;
      recoveryDone: string;
      regenerateCta: string;
      regenerating: string;
      regenerateHint: string;
      disableCta: string;
      disabling: string;
      disableHint: string;
      disabledToast: string;
      currentPassword: string;
      currentPasswordPlaceholder: string;
    };
    providers: {
      title: string;
      description: string;
      none: string;
      unlink: string;
      unlinking: string;
      unlinked: string;
      lastMethodHint: string;
    };
    security: {
      title: string;
      description: string;
      currentPassword: string;
      currentPasswordPlaceholder: string;
      newPassword: string;
      newPasswordPlaceholder: string;
      confirmPassword: string;
      confirmPasswordPlaceholder: string;
      submit: string;
      submitting: string;
      success: string;
      signOutNotice: string;
    };
    danger: {
      title: string;
      description: string;
      warning: string;
      confirmLabel: string;
      confirmHint: string;
      /** The word the user must type to arm the delete button, per locale. */
      confirmWord: string;
      password: string;
      passwordPlaceholder: string;
      submit: string;
      submitting: string;
      success: string;
    };
  };
  // Locale-free error codes returned by Zod schemas and server actions,
  // resolved at render time by `translateAuthError` (lib/i18n/errors.ts).
  authErrors: {
    emailRequired: string;
    emailInvalid: string;
    passwordRequired: string;
    passwordTooShort: string;
    passwordTooLong: string;
    passwordsDoNotMatch: string;
    confirmPasswordRequired: string;
    nameTooLong: string;
    emailTaken: string;
    passwordBreached: string;
    passwordWeak: string;
    passwordReused: string;
    currentPasswordIncorrect: string;
    tokenInvalid: string;
    totpRequired: string;
    totpInvalid: string;
    totpAlreadyEnabled: string;
    totpNotEnabled: string;
    totpUnavailable: string;
    oauthLinkBlocked: string;
    alreadyVerified: string;
    sameEmail: string;
    lastSignInMethod: string;
    rateLimited: string;
    unauthorized: string;
    generic: string;
  };
  passwordStrength: {
    label: string;
    hint: string;
    scores: {
      veryWeak: string;
      weak: string;
      fair: string;
      good: string;
      strong: string;
    };
    issues: {
      tooShort: string;
      tooLong: string;
      common: string;
      sequential: string;
      repeated: string;
      personal: string;
    };
  };
  legal: {
    backToHome: string;
    lastUpdated: string;
    terms: LegalDocument;
    privacy: LegalDocument;
  };
  map: {
    searching: string;
    emptyState: string;
    loading: string;
    filters: string;
    backToHome: string;
    closeMap: string;
    addFavorite: string;
    removeFavorite: string;
    unknownTitle: string;
    favoriteFailed: string;
    searchFailed: string;
    loadMoreFailed: string;
    invalidSearch: string;
  };
  favorites: {
    title: string;
    subtitle: string;
    empty: string;
    emptyCta: string;
  };
  theme: {
    dark: string;
    light: string;
  };
  password: {
    show: string;
    hide: string;
  };
  filters: {
    fuelType: string;
    transmission: string;
    brand: string;
    model: string;
    loadingModels: string;
    price: string;
    minPrice: string;
    maxPrice: string;
    mileage: string;
    minKm: string;
    maxKm: string;
    year: string;
    minYear: string;
    maxYear: string;
    horsePower: string;
    minHp: string;
    maxHp: string;
    listed: string;
    any: string;
    clearFilters: string;
    fuelTypes: {
      gasoline: string;
      gasoil: string;
      electricHybrid: string;
      hybrid: string;
      hybridPlugin: string;
      lpg: string;
      cng: string;
    };
    transmissions: {
      manual: string;
      automatic: string;
      semiautomatic: string;
    };
    timeFilters: {
      today: string;
      lastWeek: string;
      lastMonth: string;
    };
    location: string;
    locationPlaceholder: string;
    distance: string;
    noResults: string;
    distanceOptions: {
      km10: string;
      km25: string;
      km50: string;
      km100: string;
      km200: string;
    };
  };
  nav: {
    signIn: string;
    signUp: string;
    signOut: string;
    account: string;
    favorites: string;
  };
  meta: {
    title: string;
    description: string;
  };
}
