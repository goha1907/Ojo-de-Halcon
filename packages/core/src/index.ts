import { createAdminService } from "./admin/admin-service";
import { createAccountService } from "./accounts/account-service";
import { createSessionService } from "./auth/session-service";
import { createAccessService } from "./access/access-service";
import { createBillingService } from "./billing/billing-service";
import { createCapacityService } from "./capacity/capacity-service";
import { createGrantService } from "./grants/grant-service";
import { createFeedbackService } from "./feedback/feedback-service";
import { createPaymentService } from "./payments/payment-service";
import { createStubProvider } from "./payments/stub-provider";
import type { PaymentProvider } from "./payments/provider";
import { createProfileService } from "./profile/profile-service";
import { createTelegramService } from "./telegram/telegram-service";
import { createTrackerService } from "./trackers/tracker-service";
import type { CoreDeps } from "./types";

export function createCore(deps: CoreDeps) {
  const now = deps.now ?? (() => new Date());
  const { prisma, config, mailer, scraper } = deps;
  const capacity = createCapacityService({ prisma, now });
  const grants = createGrantService({ prisma, now, capacity });
  const billing = createBillingService({ prisma, now, grants, capacity, ...(deps.disabledKinds ? { disabledKinds: deps.disabledKinds } : {}) });
  // Payment providers: connecting a real one (Mercado Pago, an acquirer) is adding its adapter here.
  const providers: PaymentProvider[] = [
    ...(config.payments.stubEnabled
      ? [createStubProvider({ processingSeconds: config.payments.stubProcessingSeconds, now })]
      : []),
  ];
  const trackers = createTrackerService({
    prisma,
    scraper,
    now,
    grants,
    capacity,
    ...(deps.earlyAccessKinds ? { earlyAccessKinds: deps.earlyAccessKinds } : {}),
    ...(deps.disabledKinds ? { disabledKinds: deps.disabledKinds } : {}),
  });
  const access = createAccessService({ prisma, now, capacity });
  return {
    sessions: createSessionService({ prisma, config, now }),
    accounts: createAccountService({ prisma, config, mailer, now }),
    telegram: createTelegramService({ prisma, config, now }),
    profile: createProfileService({ prisma, now }),
    trackers,
    grants,
    capacity,
    access,
    billing,
    feedback: createFeedbackService({ prisma }),
    admin: createAdminService({ prisma, now, access, billing, grants, trackers }),
    payments: createPaymentService({ prisma, billing, providers, config: config.payments, now }),
  };
}

export type Core = ReturnType<typeof createCore>;

export type { CoreConfig, CoreDeps, UserDto } from "./types";
export type { LoginResult, RegisterResult } from "./accounts/account-service";
export type { CreatedSession } from "./auth/session-service";
export type { LinkConfirmResult, TelegramIdentity } from "./telegram/telegram-service";
export type { ProfileEditDecision } from "./profile/profile-service";
export type { MailMessage, Mailer } from "./mailer";
export type { PaymentIntentDto, CreateIntentResult, IntentStatus } from "./payments/payment-service";
export type { PaymentProvider, PaymentMethod, ProviderPayment } from "./payments/provider";
export { PAYMENT_METHODS } from "./payments/provider";
export { createConsoleMailer } from "./mailer";
export type { EmailData, EmailKind, RenderedEmail } from "./mail/templates";
export { EMAIL_KINDS, renderEmail } from "./mail/templates";
export { createCoreFromEnv } from "./from-env";
export type { Scraper, ScrapedTramite, PjnCaseResult, ProcessScraperOptions } from "./trackers/scraper";
export { ScraperError, createProcessScraper } from "./trackers/scraper";
export type {
  AddResult,
  DigestItem,
  EventPayload,
  PendingNotification,
  PjnPreviewResult,
  PjnStartResult,
  TrackerDto,
  TrackerService,
} from "./trackers/tracker-service";
export type { AccessPlan, AccessState } from "./access/access-service";
export type { FreeGrantDto, GrantKind, GrantService } from "./grants/grant-service";
export type {
  Actor,
  AdminService,
  FeedbackStatus,
  MutationResult,
  NewsEntryDto,
  NewsTranslation,
  OverviewDto,
  SourceHealthRow,
} from "./admin/admin-service";
export type { ListQuery, Page, UserRow } from "./admin/admin-lists";
export { FEEDBACK_STATUS_LIST, NEWS_SLUG_PATTERN } from "./admin/admin-service";
export type { PlaceBreakdown, CapacityService } from "./capacity/capacity-service";
export { GRANT_KINDS } from "./grants/grant-service";
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
