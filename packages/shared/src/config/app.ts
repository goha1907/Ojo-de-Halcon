/**
 * Non-secret application constants. Anything that is a magic number,
 * cookie name or limit lives here, never inline in feature code.
 */
export const LOCALES = ["ru", "es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const APP_CONFIG = {
  defaultLocale: "ru" as Locale,
  cookies: {
    session: "ojo_session",
    locale: "ojo_locale",
    /** Colour theme choice: "light", "dark" or absent (follow the system). */
    theme: "ojo_theme",
  },
  auth: {
    /** Random bytes of the one-time Telegram link code (24 base64url chars). */
    linkCodeBytes: 18,
    /** Random bytes of the session token. */
    sessionTokenBytes: 32,
    /** Random bytes of e-mail verification / password reset tokens. */
    emailTokenBytes: 32,
    /** How often the settings page asks whether Telegram got linked. */
    linkPollIntervalMs: 2000,
    /** Lifetime of e-mail verification links. */
    verifyEmailTtlHours: 48,
    /** Lifetime of password reset links. */
    resetPasswordTtlMinutes: 60,
    password: { minLength: 8, maxLength: 128 },
  },
  profile: {
    nameMaxLength: 60,
    minAccountAgeYears: 18,
    maxAgeYears: 120,
  },
  /** Payments. */
  payments: {
    /** An unpaid checkout is given up after this long. */
    intentTtlMinutes: 15,
    /** How often the open checkout asks whether it was paid. */
    pollIntervalMs: 2000,
    /** The test provider "processes" a payment this long before it succeeds. */
    stubProcessingSeconds: 6,
  },
  /** News list on the landing page. */
  news: { pageSize: 5 },
  /** Contacts shown to visitors. The mailbox is a placeholder until the real one exists. */
  contact: { supportEmail: "support@ojodehalcon.example" },
  /** Product limits. */
  limits: {
    /** Longest custom name of a tracked case. */
    labelMaxLength: 60,
    /** Most cases one subscription may hold (sanity cap on purchases). */
    maxCases: 100,
    /** A tracked case can be replaced (new number / released) at most this often. */
    replaceCooldownDays: 30,
    /** Free trial length, counted from account creation. */
    trialDays: 7,
    /** Cases the free trial covers. */
    trialCases: 1,
    /** Length of one paid period. */
    subscriptionDays: 30,
  },
  /**
   * Protection against probing numbers (every source reads the case at the "preview" step): lookups that are not
   * followed by adding the case count as unconfirmed. One short of the maximum brings a warning, the maximum a block.
   */
  probe: { windowMs: 60 * 60_000, maxLookups: 30, maxUnconfirmed: 5 },
  rateLimit: {
    /** Sign-in attempts, per client IP. */
    login: { windowMs: 10 * 60_000, max: 20 },
    /** Account creation, per client IP. */
    register: { windowMs: 60 * 60_000, max: 10 },
    /** Password reset / verification e-mails, per client IP. */
    email: { windowMs: 60 * 60_000, max: 10 },
    /** Adding trackers (each may start a browser), per user. */
    trackerAdd: { windowMs: 10 * 60_000, max: 20 },
    /** Creating and polling checkouts, per user. */
    payment: { windowMs: 10 * 60_000, max: 60 },
    /** Feedback messages from the landing page, per client IP. */
    feedback: { windowMs: 60 * 60_000, max: 5 },
    /** Password change attempts (each checks the current password), per user. */
    password: { windowMs: 10 * 60_000, max: 10 },
    /** Creating Telegram link codes and polling their status, per user. */
    telegramLink: { windowMs: 60_000, max: 90 },
  },
} as const;

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  links: "/links",
  settings: "/settings",
  settingsProfile: "/settings/profile",
  settingsNotifications: "/settings/notifications",
  settingsSubscription: "/settings/subscription",
} as const;

/** Anchors of the cards on the settings page; links to a specific card use `settingsHref`. */
export const SETTINGS_SECTIONS = {
  profile: "profile",
  telegram: "telegram",
  notifications: "notifications",
  people: "people",
  subscription: "subscription",
} as const;

export type SettingsSection = keyof typeof SETTINGS_SECTIONS;

/** Settings page that hosts each card. */
const SETTINGS_PAGE: Record<SettingsSection, string> = {
  profile: ROUTES.settingsProfile,
  telegram: ROUTES.settingsProfile,
  people: ROUTES.settingsProfile,
  notifications: ROUTES.settingsNotifications,
  subscription: ROUTES.settingsSubscription,
};

/** Link to a settings card: its page, scrolled to the card when the page holds several. */
export function settingsHref(section: SettingsSection): string {
  const page = SETTINGS_PAGE[section];
  return page === ROUTES.settingsProfile ? `${page}#${SETTINGS_SECTIONS[section]}` : page;
}

export const API_ROUTES = {
  news: "/api/news",
  onboarding: "/api/onboarding",
  register: "/api/auth/register",
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  forgotPassword: "/api/auth/forgot-password",
  resetPassword: "/api/auth/reset-password",
  verifyEmail: "/api/auth/verify-email",
  resendVerification: "/api/auth/resend-verification",
  profile: "/api/profile",
  telegramLink: "/api/telegram/link",
  telegram: "/api/telegram",
  account: "/api/account",
  locale: "/api/locale",
  changePassword: "/api/account/password",
  trackers: "/api/trackers",
  pjnPreview: "/api/trackers/pjn/preview",
  trackerPreview: "/api/trackers/preview",
  feedback: "/api/feedback",
  people: "/api/people",
  billingStub: "/api/billing/stub",
  paymentIntents: "/api/payments/intents",
  billingRenew: "/api/billing/renew",
  billingCases: "/api/billing/cases",
  billingSubscription: "/api/billing/subscription",
} as const;
