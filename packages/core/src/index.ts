import { createAccountService } from "./accounts/account-service";
import { createSessionService } from "./auth/session-service";
import { createAccessService } from "./access/access-service";
import { createBillingService } from "./billing/billing-service";
import { createFeedbackService } from "./feedback/feedback-service";
import { createProfileService } from "./profile/profile-service";
import { createTelegramService } from "./telegram/telegram-service";
import { createTrackerService } from "./trackers/tracker-service";
import type { CoreDeps } from "./types";

export function createCore(deps: CoreDeps) {
  const now = deps.now ?? (() => new Date());
  const { prisma, config, mailer, scraper } = deps;
  return {
    sessions: createSessionService({ prisma, config, now }),
    accounts: createAccountService({ prisma, config, mailer, now }),
    telegram: createTelegramService({ prisma, config, now }),
    profile: createProfileService({ prisma, now }),
    trackers: createTrackerService({
      prisma,
      scraper,
      now,
    }),
    access: createAccessService({ prisma, now }),
    billing: createBillingService({ prisma, now }),
    feedback: createFeedbackService({ prisma }),
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
export type { Scraper, ScrapedTramite, PjnCaseResult, PjnPartyRow, ProcessScraperOptions } from "./trackers/scraper";
export { ScraperError, createProcessScraper } from "./trackers/scraper";
export type {
  AddResult,
  DigestItem,
  EventPayload,
  PendingNotification,
  PjnCandidate,
  PjnPreviewResult,
  PjnSearchResult,
  PjnStartResult,
  TrackerDto,
  TrackerService,
} from "./trackers/tracker-service";
export type { AccessPlan, AccessState } from "./access/access-service";
export { resolveAccess } from "./access/access-service";
export type {
  BillingService,
  BillingStateDto,
  CheckoutResult,
  PaymentDto,
  QuoteDto,
  RenewResult,
  TrackerBillingResult,
} from "./billing/billing-service";
