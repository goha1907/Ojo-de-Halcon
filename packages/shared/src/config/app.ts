/**
 * Non-secret application constants. Anything that is a magic number,
 * cookie name or limit lives here, never inline in feature code.
 */
export const LOCALES = ["ru", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const APP_CONFIG = {
  defaultLocale: "ru" as Locale,
  cookies: {
    session: "ojo_session",
    locale: "ojo_locale",
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
  rateLimit: {
    /** Sign-in attempts, per client IP. */
    login: { windowMs: 10 * 60_000, max: 20 },
    /** Account creation, per client IP. */
    register: { windowMs: 60 * 60_000, max: 10 },
    /** Password reset / verification e-mails, per client IP. */
    email: { windowMs: 60 * 60_000, max: 10 },
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
  news: "/news",
  links: "/links",
  settings: "/settings",
} as const;

export const API_ROUTES = {
  register: "/api/auth/register",
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  forgotPassword: "/api/auth/forgot-password",
  resetPassword: "/api/auth/reset-password",
  verifyEmail: "/api/auth/verify-email",
  resendVerification: "/api/auth/resend-verification",
  profile: "/api/profile",
  services: "/api/services",
  telegramLink: "/api/telegram/link",
  telegram: "/api/telegram",
  account: "/api/account",
} as const;
