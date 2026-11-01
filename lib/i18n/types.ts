import type { useTranslations } from "next-intl";

interface LegalSection {
  /** The section's anchor: the same in every locale, never built from the heading (PAGES-74). */
  id: string;
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
    closeToast: string;
  };
  hero: {
    title: string;
    titleHighlight: string;
    subtitle: string;
    exploreMap: string;
  };
  auth: {
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
    confirmPassword: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    signUp: string;
    alreadyHaveAccount: string;
    accountCreated: string;
    legalNotice: string;
    headline: string;
    headlineHighlight: string;
    tagline: string;
    signInLink: string;
    registerHeadline: string;
    registerHeadlineHighlight: string;
  };
  forgotPassword: {
    title: string;
    description: string;
    submit: string;
    backToLogin: string;
    successTitle: string;
    successDescription: string;
    headline: string;
    headlineHighlight: string;
    successHeadline: string;
    successHeadlineHighlight: string;
  };
  verifyEmail: {
    pendingTitle: string;
    pendingDescription: string;
    title: string;
    submit: string;
    successTitle: string;
    successDescription: string;
    signIn: string;
    invalidTitle: string;
    invalidDescription: string;
    backToRegister: string;
    resend: string;
    resent: string;
    pendingHeadline: string;
    pendingHeadlineHighlight: string;
    headline: string;
    headlineHighlight: string;
    line: string;
    hint: string;
    successHeadline: string;
    successHeadlineHighlight: string;
    invalidHeadline: string;
    invalidHeadlineHighlight: string;
  };
  confirmEmail: {
    title: string;
    submit: string;
    successTitle: string;
    successDescription: string;
    backToAccount: string;
    invalidTitle: string;
    invalidDescription: string;
    headline: string;
    headlineHighlight: string;
    line: string;
    hint: string;
    successHeadline: string;
    successHeadlineHighlight: string;
    invalidHeadline: string;
    invalidHeadlineHighlight: string;
  };
  resetPassword: {
    title: string;
    description: string;
    newPassword: string;
    confirmPassword: string;
    confirmPasswordPlaceholder: string;
    submit: string;
    success: string;
    invalidTitle: string;
    invalidDescription: string;
    requestNewLink: string;
    backToLogin: string;
    headline: string;
    headlineHighlight: string;
    invalidHeadline: string;
    invalidHeadlineHighlight: string;
  };
  account: {
    title: string;
    description: string;
    descriptionShort: string;
    cancel: string;
    loading: string;
    summary: {
      saved: string;
      alerts: string;
      since: string;
    };
    profile: {
      changeCta: string;
      name: string;
      namePlaceholder: string;
      submit: string;
      success: string;
    };
    email: {
      title: string;
      line: string;
      lineLocked: string;
      verified: string;
      unverified: string;
      verifyCta: string;
      verifySent: string;
      newEmail: string;
      newEmailPlaceholder: string;
      currentPassword: string;
      submit: string;
      submitted: string;
      notice: string;
    };
    twoFactor: {
      title: string;
      line: string;
      enabled: string;
      disabled: string;
      enableCta: string;
      manageCta: string;
      setupCta: string;
      scanTitle: string;
      scanDescription: string;
      manualLabel: string;
      manualHint: string;
      codeLabel: string;
      codePlaceholder: string;
      recoveryHint: string;
      confirm: string;
      enabledToast: string;
      recoveryTitle: string;
      recoveryDescription: string;
      recoveryWarning: string;
      copyCodes: string;
      copied: string;
      copyFailed: string;
      recoveryDone: string;
      regenerateCta: string;
      regenerateHint: string;
      disableCta: string;
      disableHint: string;
      disabledToast: string;
      currentPassword: string;
    };
    sessions: {
      title: string;
      open: string;
      thisDevice: string;
      otherDevice: string;
      line: string;
      current: string;
      unknownDevice: string;
      device: string;
      signOutSession: string;
      signOutSessionNamed: string;
      signOutOthers: string;
      signedOutOthers: string;
      warning: string;
      submit: string;
      loadError: string;
    };
    export: {
      title: string;
      description: string;
      submit: string;
    };
    providers: {
      title: string;
      connected: string;
      line: string;
      none: string;
      unlink: string;
      unlinked: string;
      lastMethodHint: string;
    };
    security: {
      title: string;
      line: string;
      changeCta: string;
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
      confirmPasswordPlaceholder: string;
      submit: string;
      success: string;
      signOutNotice: string;
    };
    danger: {
      title: string;
      line: string;
      question: string;
      confirmLabel: string;
      confirmHint: string;
      confirmWord: string;
      password: string;
      submit: string;
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
    onThisPage: string;
    lastUpdated: string;
    terms: LegalDocument;
    privacy: LegalDocument;
  };
  map: {
    loading: string;
    filters: string;
    filtersActive: string;
    quickFilters: string;
    addFavorite: string;
    removeFavorite: string;
    markerLabel: string;
    zoomIn: string;
    zoomOut: string;
    viewListing: string;
    closePreview: string;
    pinGroup: string;
    sheetHandle: string;
    unavailable: string;
    toggleAttribution: string;
    surface: string;
  };
  // docs/specs/redesign-map.md › Contracts › i18n keys (MAPUI).
  search: {
    where: string;
    car: string;
    price: string;
    descriptionLabel: string;
    descriptionField: string;
    descriptionPlaceholder: string;
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
    statusCount: string;
    statusMore: string;
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
    emptyCta: string;
    sortRecent: string;
    sortPrice: string;
    sortKm: string;
    mapLabel: string;
    mapTitle: string;
    mapEmpty: string;
    emptyTitle: string;
    emptyPunchline: string;
    emptyLine: string;
    emptyLinePhone: string;
    removed: string;
    undo: string;
  };
  alerts: {
    title: string;
    subtitle: string;
    emptyCta: string;
    create: string;
    delete: string;
    matchCount: string;
    inactive: string;
    newAlert: string;
    viewAllMatches: string;
    createdOn: string;
    deleteShort: string;
    deleteConfirmNamed: string;
    cancel: string;
    mapLabel: string;
    mapEmpty: string;
    zoneLabel: string;
    emptyTitle: string;
    emptyPunchline: string;
    emptyLine: string;
    emptyLinePhone: string;
    noMatchesYet: string;
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
    km: string;
    kmMin: string;
    kmMax: string;
    year: string;
    yearFrom: string;
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
    maxKmPlaceholder: string;
    minKmPlaceholder: string;
    kmSuffix: string;
    minYearPlaceholder: string;
    maxKmChip: string;
    minKmChip: string;
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
    skipToContent: string;
  };
  meta: {
    title: string;
    description: string;
  };
  // `pageTitle`, `pagePunchline`, `retry` and `pageLine` are the page-error
  // state's (components/ui/PageError.tsx), on /favorites (SAVED-32), /alerts
  // and /alerts/[id] (ALERTUI-42), and /map, which gives its own line (MAPUI-34).
  errors: {
    retry: string;
    pageTitle: string;
    pagePunchline: string;
    pageLine: string;
  };
  // The not-found page's headline and line (docs/specs/redesign-pages.md, PAGES-65).
  notFound: {
    question: string;
    punchline: string;
    line: string;
  };
}

/** next-intl's translate function, as a component hands it to its own helpers. */
export type Translate = ReturnType<typeof useTranslations>;
