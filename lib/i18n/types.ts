import type { useTranslations } from "next-intl";

interface LegalSection {
  heading: string;
  body: string;
}

interface LegalDocument {
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
    close: string;
  };
  hero: {
    title: string;
    titleHighlight: string;
    subtitle: string;
    exploreMap: string;
  };
  auth: {
    headline: string;
    headlineHighlight: string;
    tagline: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    forgotPassword: string;
    signIn: string;
    noAccount: string;
    createOne: string;
    continueWithGoogle: string;
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
    totpInvalid: string;
    totpAlreadyEnabled: string;
    totpNotEnabled: string;
    oauthLinkBlocked: string;
    alreadyVerified: string;
    sameEmail: string;
    lastSignInMethod: string;
    rateLimited: string;
    unauthorized: string;
    conflict: string;
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
    loading: string;
    filters: string;
    backToHome: string;
    addFavorite: string;
    removeFavorite: string;
    markerLabel: string;
    zoomIn: string;
    zoomOut: string;
    viewListing: string;
    preview: string;
    closePreview: string;
    pinGroup: string;
    sheetHandle: string;
  };
  // docs/specs/redesign-map.md › Contracts › i18n keys (MAPUI).
  search: {
    where: string;
    car: string;
    price: string;
    wherePlaceholder: string;
    whereLabel: string;
    places: string;
    carPlaceholder: string;
    carLabel: string;
    carOptions: string;
    modelOf: string;
    modelOfLabel: string;
    priceAny: string;
    allSpain: string;
    anyBrand: string;
    anyPrice: string;
    radius: string;
    radiusOption: string;
    brands: string;
    models: string;
    results: string;
    submit: string;
    sheetTitle: string;
    filtersTitle: string;
    clear: string;
    clearText: string;
    showCars: string;
    close: string;
    closeFilters: string;
    remove: string;
    brandModel: string;
    placeRadius: string;
    priceUpTo: string;
    priceFrom: string;
    summaryUpTo: string;
    summaryFrom: string;
    priceMin: string;
    priceMax: string;
    priceMinSlider: string;
    priceMaxSlider: string;
    priceCurrency: string;
    noBrand: string;
    noPlace: string;
    placeSearchDown: string;
  };
  mapStates: {
    loading: string;
    headingLoading: string;
    headingNone: string;
    headingError: string;
    headingCount: string;
    headingMore: string;
    emptyTitle: string;
    emptyWiden: string;
    emptyRemove: string;
    emptyLineRadius: string;
    emptyLine: string;
    emptyLineNoFilters: string;
    widenTo: string;
    widenAllSpain: string;
    clearFilters: string;
    statusNoneRadius: string;
    statusNone: string;
    errorTitle: string;
    errorRetry: string;
    errorLine: string;
    retry: string;
    statusError: string;
    pageErrorLine: string;
  };
  createAlert: {
    open: string;
    title: string;
    name: string;
    submit: string;
    cancel: string;
    tooBroad: string;
    nameRequired: string;
    networkError: string;
    created: string;
    alreadyExisted: string;
    viewAlerts: string;
  };
  favorites: {
    title: string;
    subtitle: string;
    empty: string;
    emptyCta: string;
  };
  alerts: {
    title: string;
    subtitle: string;
    empty: string;
    emptyCta: string;
    create: string;
    delete: string;
    matchCount: string;
    inactive: string;
    noMatchesYet: string;
    backToAlerts: string;
    unsubscribed: string;
    unsubscribedBody: string;
    email: {
      subject: string;
      heading: string;
      intro: string;
      viewAll: string;
      unsubscribe: string;
      footer: string;
    };
  };
  alertErrors: {
    unauthenticated: string;
    invalidCriteria: string;
    criteriaTooBroad: string;
    tooManyAlerts: string;
    // The code is gone from ALERT_ERROR (PLAT-12, docs/specs/core-platform.md)
    // — a database or programming error now throws instead of resolving to
    // it — but the copy stays: `translateError` returns this field, not
    // `authErrors.generic`, for an unrecognized messageKey.
    unexpected: string;
  };
  // Favorites had no error namespace before PLAT-13 (docs/specs/core-platform.md).
  favoriteErrors: {
    unauthenticated: string;
    invalidListing: string;
  };
  localeErrors: {
    invalidLocale: string;
  };
  footer: {
    privacy: string;
    terms: string;
    illustrations: string;
  };
  password: {
    show: string;
    hide: string;
  };
  filters: {
    fuelType: string;
    transmission: string;
    price: string;
    maxKm: string;
    year: string;
    listed: string;
    transmissions: {
      manual: string;
      automatic: string;
    };
    fuelGroups: {
      gasoline: string;
      gasoil: string;
      hybrid: string;
      electric: string;
      lpg: string;
    };
    gearboxAll: string;
    listedChoices: {
      any: string;
      today: string;
      lastWeek: string;
      lastMonth: string;
    };
    kmAndYear: string;
    maxKmPlaceholder: string;
    maxKmSuffix: string;
    minYearPlaceholder: string;
    maxKmChip: string;
    minYearChip: string;
    brandAndModel: string;
  };
  nav: {
    signIn: string;
    signOut: string;
    account: string;
    map: string;
    saved: string;
    alerts: string;
    backToMap: string;
    back: string;
    language: string;
    main: string;
    createAccount: string;
    localeEs: string;
    localeEn: string;
  };
  meta: {
    title: string;
    description: string;
  };
  // Shown by components/ui/RouteError.tsx, the shared error.tsx boundary for
  // /favorites, /alerts and /alerts/[id] (PLAT-14, docs/specs/core-platform.md).
  errors: {
    pageLoadFailed: string;
    retry: string;
    pageTitle: string;
    pagePunchline: string;
  };
}

/** next-intl's translate function, as a component hands it to its own helpers. */
export type Translate = ReturnType<typeof useTranslations>;
