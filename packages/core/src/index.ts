import { createAccountService } from "./accounts/account-service";
import { createSessionService } from "./auth/session-service";
import { createPreferencesService } from "./notifications/preferences-service";
import { createProfileService } from "./profile/profile-service";
import { createTelegramService } from "./telegram/telegram-service";
import type { CoreDeps } from "./types";

export function createCore(deps: CoreDeps) {
  const now = deps.now ?? (() => new Date());
  const { prisma, config, mailer } = deps;
  return {
    sessions: createSessionService({ prisma, config, now }),
    accounts: createAccountService({ prisma, config, mailer, now }),
    telegram: createTelegramService({ prisma, config, now }),
    profile: createProfileService({ prisma, now }),
    preferences: createPreferencesService({ prisma }),
  };
}

export type Core = ReturnType<typeof createCore>;

export type { CoreConfig, CoreDeps, UserDto } from "./types";
export type { LoginResult, RegisterResult } from "./accounts/account-service";
export type { CreatedSession } from "./auth/session-service";
export type { LinkConfirmResult, TelegramIdentity } from "./telegram/telegram-service";
export type { ProfileEditDecision } from "./profile/profile-service";
export type { MailMessage, Mailer } from "./mailer";
export { createConsoleMailer } from "./mailer";
export { createCoreFromEnv } from "./from-env";
