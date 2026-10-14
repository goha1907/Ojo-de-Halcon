import { createHash } from "node:crypto";
import type { Prisma, PrismaClient, Tracker, TrackerSnapshot } from "@ojo/db";
import {
  SERVICE_GROUPS,
  APP_CONFIG,
  TRACKER_CONFIG,
  TRACKER_KIND_SECTION,
  caratulaMatchesName,
  findJurisdiction,
  parseExpediente,
  parsePjnReference,
  pjnReference,
  type TrackerHeaderFields,
  type TrackerKindValue,
  type TrackerStatusValue,
  type TrackerStep,
} from "@ojo/shared";
import { resolveAccess } from "../access/access-service";
import { ScraperError, type Scraper } from "./scraper";

export interface TrackerDto {
  id: string;
  kind: TrackerKindValue;
  reference: string;
  label: string | null;
  status: TrackerStatusValue;
  /** false: marked for removal from the subscription at the next period. */
  keptInSubscription: boolean;
  /** Where notifications of this case go. */
  notifyTelegram: boolean;
  notifyWhatsapp: boolean;
  /** Relative the case belongs to; null = the account owner. */
  person: { id: string; name: string } | null;
  /** When the slot started holding this case (added, or last replaced). */
  addedAt: string;
  /** The case may be replaced now (cooldown over, or the number was never read). */
  canReplace: boolean;
  /** Tracking has not started yet: nothing was read, so it can also simply be removed. */
  notStarted: boolean;
  /** When the cooldown ends; null when replacement is already possible. */
  replaceAvailableAt: string | null;
  header: TrackerHeaderFields;
  steps: TrackerStep[];
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface PjnCandidate {
  jurisdiction: string;
  number: string;
  year: string;
  expediente: string;
  dependencia: string;
  caratula: string;
}

type AddFailure =
  | "ALREADY_EXISTS"
  | "NO_FREE_SLOT"
  | "SUBSCRIPTION_REQUIRED"
  | "PERSON_NOT_FOUND";

export type AddResult =
  | { ok: true; tracker: TrackerDto }
  | { ok: false; reason: AddFailure };

export type PjnStartResult =
  | { ok: true; tracker: TrackerDto }
  | { ok: false; reason: AddFailure | "NOT_FOUND" | "SOURCE_DOWN" };

export type PjnPreviewResult =
  | { ok: true; header: TrackerHeaderFields }
  | { ok: false; reason: AddFailure | "NOT_FOUND" | "SOURCE_DOWN" };

export type PjnSearchResult =
  | { ok: true; candidates: PjnCandidate[] }
  | { ok: false; reason: "PROFILE_INCOMPLETE" | "NO_COURT" | "SOURCE_DOWN" | "PERSON_NOT_FOUND" };

/** One notification = one change. A check that finds several new stages creates several events. */
export interface EventPayload {
  /** The stage that appeared; null when only the status in the header changed. */
  step: TrackerStep | null;
  header: TrackerHeaderFields;
  /** "Case added": the first report of a case, showing its latest stage. */
  initial?: boolean;
}

/** Latest known stage of one case, for the digest sent when Telegram gets linked. */
export interface DigestItem {
  kind: TrackerKindValue;
  section: string;
  /** Whose case it is: the relative's name, or the account owner's (null when unknown). */
  who: string | null;
  isRelative: boolean;
  /** Identifies the case in messages: trámite number or court file number. */
  caseId: string;
  header: TrackerHeaderFields;
  /** Most recent stage, or null when none is known yet. */
  step: TrackerStep | null;
}

export interface PendingNotification {
  eventId: string;
  telegramId: bigint;
  locale: string;
  kind: TrackerKindValue;
  /** Whose case it is: the relative's name, or the account owner's (null when unknown). */
  who: string | null;
  /** Identifies the case in messages: trámite number or court file number. */
  caseId: string;
  label: string | null;
  reference: string;
  payload: EventPayload;
}

/** Upper bound of separate messages produced by one check (protects against floods). */
const MAX_EVENTS_PER_CHECK = 10;
const HOUR_MS = 3_600_000;
/** A claimed notification that was never confirmed is retried after this time. */
const CLAIM_TIMEOUT_MS = 5 * 60_000;

/** Human identifier of a case for messages: the trámite number or the court file number. */
function caseIdentifier(kind: TrackerKindValue, reference: string, header: TrackerHeaderFields): string {
  if (kind !== "PJN") return reference;
  if (header.expediente) return header.expediente;
  const ref = parsePjnReference(reference);
  return ref ? `${ref.number}/${ref.year}` : reference;
}

function stepKey(step: TrackerStep): string {
  return `${step.date}|${step.title}|${step.detail}`;
}

/** Structured values are stored as JSON columns. */
function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function contentHash(header: TrackerHeaderFields, steps: TrackerStep[]): string {
  return createHash("sha256").update(JSON.stringify({ header, steps })).digest("hex");
}

/**
 * Whether a re-read is news. Header fields that were not stored before (the scraper learned
 * to read more) are not a change; a changed or removed known field, or other stages, are.
 */
function isMeaningfulChange(
  previous: { header: TrackerHeaderFields; steps: TrackerStep[] },
  next: { header: TrackerHeaderFields; steps: TrackerStep[] },
): boolean {
  const stagesChanged = JSON.stringify(previous.steps) !== JSON.stringify(next.steps);
  const knownFieldChanged = Object.entries(previous.header).some(([key, value]) => next.header[key] !== value);
  return stagesChanged || knownFieldChanged;
}

/** Replacement rule: a slot may change its case every `replaceCooldownDays` (a never-read number is a typo). */
function replaceState(
  tracker: Tracker & { snapshot: TrackerSnapshot | null },
  at: Date = new Date(),
): { canReplace: boolean; replaceAvailableAt: string | null; notStarted: boolean } {
  // "not started": a number nothing was read for, or a court case that never had its first full read
  // (the first full read sets `initialNotified`, even when the case has no stages yet)
  const neverRead = tracker.kind === "PJN" ? !tracker.initialNotified : tracker.snapshot === null;
  const available = new Date(tracker.slotSince.getTime() + APP_CONFIG.limits.replaceCooldownDays * 86_400_000);
  if (neverRead || available <= at) return { canReplace: true, replaceAvailableAt: null, notStarted: neverRead };
  return { canReplace: false, replaceAvailableAt: available.toISOString(), notStarted: false };
}

export function createTrackerService(deps: {
  prisma: PrismaClient;
  scraper: Scraper;
  now: () => Date;
  /** Relatives are switched on; when off only the owner's own trackers are visible and checked. */
  relativesEnabled: boolean;
}) {
  const { prisma, scraper, now, relativesEnabled } = deps;
  /** Prisma filter hiding relatives' trackers while the feature is dormant. */
  const ownerOnly = relativesEnabled ? {} : { personId: null };

  type TrackerWithSnapshot = Tracker & {
    snapshot: TrackerSnapshot | null;
    person?: { id: string; firstName: string; lastName: string } | null;
  };

  function toDto(tracker: TrackerWithSnapshot): TrackerDto {
    const kind = tracker.kind as TrackerKindValue;
    return {
      id: tracker.id,
      kind,
      reference: tracker.reference,
      label: tracker.label,
      status: tracker.status as TrackerStatusValue,
      keptInSubscription: tracker.keepNext,
      notifyTelegram: tracker.notifyTelegram,
      notifyWhatsapp: tracker.notifyWhatsapp,
      person: tracker.person
        ? { id: tracker.person.id, name: `${tracker.person.firstName} ${tracker.person.lastName}` }
        : null,
      addedAt: tracker.slotSince.toISOString(),
      ...replaceState(tracker, now()),
      header: (tracker.snapshot?.header ?? {}) as TrackerHeaderFields,
      steps: (tracker.snapshot?.steps ?? []) as unknown as TrackerStep[],
      lastCheckedAt: tracker.lastCheckedAt ? tracker.lastCheckedAt.toISOString() : null,
      lastError: tracker.lastError,
    };
  }

  async function list(userId: string): Promise<TrackerDto[]> {
    const rows = await prisma.tracker.findMany({
      where: { userId, ...ownerOnly },
      include: { snapshot: true, person: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDto);
  }

  /**
   * May one more case be tracked. A subscription holds as many cases as were paid for
   * (finished and paused cases do not occupy a slot); the free trial covers one case.
   */
  async function addGate(userId: string): Promise<"OK" | "NO_FREE_SLOT" | "SUBSCRIPTION_REQUIRED"> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { trialStartedAt: true, subscriptionUntil: true, paidCases: true },
    });
    const access = resolveAccess(user, now());
    if (access.plan === "trial_expired") return "SUBSCRIPTION_REQUIRED";
    const occupied = await prisma.tracker.count({
      where: { userId, status: { notIn: ["FINISHED", "PAUSED"] } },
    });
    if (access.plan === "subscription") return occupied < user.paidCases ? "OK" : "NO_FREE_SLOT";
    // the trial covers exactly one case in total
    return occupied === 0 ? "OK" : "SUBSCRIPTION_REQUIRED";
  }

  /** The person must belong to the user; null/undefined means the owner. */
  async function resolvePerson(
    userId: string,
    personId: string | null | undefined,
  ): Promise<
    { ok: true; personId: string | null; personKey: string; notifyTelegram: boolean } | { ok: false }
  > {
    if (!personId) return { ok: true, personId: null, personKey: "self", notifyTelegram: true };
    if (!relativesEnabled) return { ok: false };
    const person = await prisma.person.findFirst({ where: { id: personId, userId } });
    return person
      ? { ok: true, personId: person.id, personKey: person.id, notifyTelegram: person.notifyTelegram }
      : { ok: false };
  }

  /**
   * Adds a trámite number to one source. RENAPER and Correo are independent:
   * a person may wait for the DNI at either one or both, so each is added on
   * its own (and counts as its own case).
   */
  async function addTramite(
    userId: string,
    kind: Extract<TrackerKindValue, "RENAPER" | "CORREO">,
    reference: string,
    personId?: string | null,
    label?: string | null,
  ): Promise<AddResult> {
    const person = await resolvePerson(userId, personId);
    if (!person.ok) return { ok: false, reason: "PERSON_NOT_FOUND" };
    const { personKey } = person;
    const existing = await prisma.tracker.findFirst({
      where: { userId, personKey, kind, reference, status: { not: "FINISHED" } },
    });
    if (existing) return { ok: false, reason: "ALREADY_EXISTS" };
    const gate = await addGate(userId);
    if (gate !== "OK") return { ok: false, reason: gate };

    const tracker = await prisma.tracker.upsert({
      where: { userId_personKey_kind_reference: { userId, personKey, kind, reference } },
      create: {
        userId,
        personId: person.personId,
        personKey,
        notifyTelegram: person.notifyTelegram,
        kind,
        reference,
        label: label ?? null,
        nextCheckAt: now(),
      },
      update: { status: "ACTIVE", nextCheckAt: now(), lastError: null, label: label ?? null },
    });
    const full = await prisma.tracker.findUniqueOrThrow({
      where: { id: tracker.id },
      include: { snapshot: true, person: true },
    });
    return { ok: true, tracker: toDto(full) };
  }

  /**
   * Replaces the trámite number of a RENAPER/Correo slot. Allowed when nothing
   * was ever read for it (a typo) or when the slot has held its case for the
   * cooldown period (30 days).
   * The old stages are dropped and the new number starts as a fresh case.
   */
  async function replaceNumber(
    userId: string,
    trackerId: string,
    newReference: string,
  ): Promise<"OK" | "NOT_ALLOWED" | "ALREADY_EXISTS"> {
    const tracker = await prisma.tracker.findFirst({
      where: { id: trackerId, userId, kind: { in: ["RENAPER", "CORREO"] }, status: "ACTIVE" },
      include: { snapshot: true },
    });
    if (!tracker || !replaceState(tracker, now()).canReplace) return "NOT_ALLOWED";
    const duplicate = await prisma.tracker.findFirst({
      where: {
        userId,
        personKey: tracker.personKey,
        kind: tracker.kind,
        reference: newReference,
        id: { not: tracker.id },
      },
    });
    if (duplicate) return "ALREADY_EXISTS";
    await prisma.$transaction([
      prisma.trackerEvent.deleteMany({ where: { trackerId: tracker.id } }),
      prisma.trackerSnapshot.deleteMany({ where: { trackerId: tracker.id } }),
      prisma.tracker.update({
        where: { id: tracker.id },
        data: {
          reference: newReference,
          lastError: null,
          lastCheckedAt: null,
          initialNotified: false,
          // only a real replacement restarts the cooldown, not fixing a typo
          ...(tracker.snapshot === null ? {} : { slotSince: now() }),
          nextCheckAt: now(),
        },
      }),
    ]);
    return "OK";
  }

  /**
   * Frees the slot of a confirmed case under the same replacement rule; the user
   * then adds the new case (used for court cases, which are chosen in a flow).
   */
  async function releaseCase(userId: string, trackerId: string): Promise<boolean> {
    const tracker = await prisma.tracker.findFirst({
      where: { id: trackerId, userId, status: { in: ["ACTIVE", "FINISHED"] } },
      include: { snapshot: true },
    });
    if (!tracker || !replaceState(tracker, now()).canReplace) return false;
    await prisma.tracker.delete({ where: { id: tracker.id } });
    return true;
  }

  /** Switches the Telegram notifications of one case (any time). */
  async function setNotify(userId: string, trackerId: string, notifyTelegram: boolean): Promise<boolean> {
    const result = await prisma.tracker.updateMany({
      where: { id: trackerId, userId },
      data: { notifyTelegram },
    });
    return result.count === 1;
  }

  /** Renames a tracked case (any time; the name is only a note for the user). */
  async function setLabel(userId: string, trackerId: string, label: string | null): Promise<boolean> {
    const result = await prisma.tracker.updateMany({
      where: { id: trackerId, userId },
      data: { label },
    });
    return result.count === 1;
  }

  /** Searches the court registry by the profile name and keeps results that match it. */
  async function findPjnByProfile(userId: string, personId?: string | null): Promise<PjnSearchResult> {
    const user = personId
      ? await prisma.person.findFirst({ where: { id: personId, userId } })
      : await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user) return { ok: false, reason: "PERSON_NOT_FOUND" };
    if (!user.firstName || !user.lastName) return { ok: false, reason: "PROFILE_INCOMPLETE" };
    if (!user.pjnJurisdiction || !findJurisdiction(user.pjnJurisdiction)) {
      return { ok: false, reason: "NO_COURT" };
    }
    try {
      // The site expects "SURNAME NAME" without commas; a bare surname is the fallback
      // (e.g. when the registry holds only one of several given names).
      const full = `${user.lastName} ${user.firstName}`;
      let rows = await scraper.pjnParty({ jurisdiction: user.pjnJurisdiction, name: full });
      if (rows.length === 0) {
        rows = await scraper.pjnParty({ jurisdiction: user.pjnJurisdiction, name: user.lastName });
      }
      const tracked = new Set(
        (
          await prisma.tracker.findMany({
            where: { userId, personKey: personId ?? "self", kind: "PJN" },
            select: { reference: true },
          })
        ).map((item) => item.reference),
      );
      const candidates: PjnCandidate[] = [];
      for (const row of rows) {
        if (!caratulaMatchesName(row.caratula, user.firstName, user.lastName)) continue;
        const parsed = parseExpediente(row.expediente);
        if (!parsed) continue;
        const reference = pjnReference({
          jurisdiction: user.pjnJurisdiction,
          number: parsed.number,
          year: parsed.year,
        });
        if (tracked.has(reference)) continue;
        // the search already returned the header: reuse it when the user confirms
        rememberPreview(previewKey(userId, personId ? personId : "self", reference), {
          expediente: row.expediente,
          dependencia: row.dependencia,
          sit_actual: row.situacion,
          caratula: row.caratula,
        });
        candidates.push({
          jurisdiction: user.pjnJurisdiction,
          number: parsed.number,
          year: parsed.year,
          expediente: row.expediente,
          dependencia: row.dependencia,
          caratula: row.caratula,
        });
      }
      return { ok: true, candidates };
    } catch {
      return { ok: false, reason: "SOURCE_DOWN" };
    }
  }

  /** Headers read in the preview step, reused when the user confirms (no second captcha). */
  const previews = new Map<string, { header: TrackerHeaderFields; at: number }>();
  const PREVIEW_TTL_MS = 15 * 60_000;
  const previewKey = (userId: string, personKey: string, reference: string) =>
    `${userId}:${personKey}:${reference}`;
  function rememberPreview(key: string, header: TrackerHeaderFields): void {
    const cutoff = now().getTime() - PREVIEW_TTL_MS;
    for (const [stored, entry] of previews) if (entry.at < cutoff) previews.delete(stored);
    previews.set(key, { header, at: now().getTime() });
  }
  function takePreview(key: string): TrackerHeaderFields | null {
    const entry = previews.get(key);
    previews.delete(key);
    return entry && entry.at >= now().getTime() - PREVIEW_TTL_MS ? entry.header : null;
  }

  /** Everything that must hold before a court case may be looked up or added. */
  async function pjnPreflight(
    userId: string,
    input: { jurisdiction: string; number: string; year: string },
    personId: string | null | undefined,
  ): Promise<
    | { ok: true; personId: string | null; personKey: string; reference: string; notifyTelegram: boolean }
    | { ok: false; reason: AddFailure }
  > {
    const person = await resolvePerson(userId, personId);
    if (!person.ok) return { ok: false, reason: "PERSON_NOT_FOUND" };
    const { personKey } = person;
    const reference = pjnReference(input);
    const existing = await prisma.tracker.findUnique({
      where: { userId_personKey_kind_reference: { userId, personKey, kind: "PJN", reference } },
    });
    if (existing && existing.status !== "FINISHED") return { ok: false, reason: "ALREADY_EXISTS" };
    const gate = await addGate(userId);
    if (gate !== "OK") return { ok: false, reason: gate };
    return { ok: true, personId: person.personId, personKey, reference, notifyTelegram: person.notifyTelegram };
  }

  async function readCaseHeader(input: {
    jurisdiction: string;
    number: string;
    year: string;
  }): Promise<{ ok: true; header: TrackerHeaderFields } | { ok: false; reason: "NOT_FOUND" | "SOURCE_DOWN" }> {
    try {
      const result = await scraper.pjnCase({ ...input, headerOnly: true });
      return { ok: true, header: { ...result.header } };
    } catch (error) {
      const notFound = error instanceof ScraperError && error.code === "not_found";
      return { ok: false, reason: notFound ? "NOT_FOUND" : "SOURCE_DOWN" };
    }
  }

  /**
   * Step one of adding a court case: finds the case and returns its header so
   * the user can see exactly what would be tracked. Nothing is stored.
   */
  async function previewPjn(
    userId: string,
    input: { jurisdiction: string; number: string; year: string },
    personId?: string | null,
  ): Promise<PjnPreviewResult> {
    const checked = await pjnPreflight(userId, input, personId);
    if (!checked.ok) return checked;
    const read = await readCaseHeader(input);
    if (!read.ok) return read;
    rememberPreview(previewKey(userId, checked.personKey, checked.reference), read.header);
    return { ok: true, header: read.header };
  }

  async function createPjn(
    userId: string,
    input: { jurisdiction: string; number: string; year: string },
    personId: string | null | undefined,
    status: "ACTIVE" | "PENDING_CONFIRMATION",
    label?: string | null,
  ): Promise<PjnStartResult> {
    const checked = await pjnPreflight(userId, input, personId);
    if (!checked.ok) return checked;
    const { personKey, reference } = checked;
    let header = takePreview(previewKey(userId, personKey, reference));
    if (!header) {
      const read = await readCaseHeader(input);
      if (!read.ok) return read;
      header = read.header;
    }
    const tracker = await prisma.tracker.upsert({
      where: { userId_personKey_kind_reference: { userId, personKey, kind: "PJN", reference } },
      create: {
        userId,
        personId: checked.personId,
        personKey,
        notifyTelegram: checked.notifyTelegram,
        kind: "PJN",
        reference,
        status,
        label: label ?? null,
        lastCheckedAt: now(),
        nextCheckAt: now(),
      },
      update: {
        status,
        label: label ?? null,
        lastError: null,
        lastCheckedAt: now(),
        nextCheckAt: now(),
        slotSince: now(),
      },
    });
    await prisma.trackerSnapshot.upsert({
      where: { trackerId: tracker.id },
      create: { trackerId: tracker.id, header: asJson(header), steps: [], contentHash: contentHash(header, []) },
      update: { header: asJson(header), steps: [], contentHash: contentHash(header, []) },
    });
    const full = await prisma.tracker.findUniqueOrThrow({
      where: { id: tracker.id },
      include: { snapshot: true, person: true },
    });
    return { ok: true, tracker: toDto(full) };
  }

  /** Step two: the user saw the header and confirmed; the case is tracked from now on. */
  async function addPjn(
    userId: string,
    input: { jurisdiction: string; number: string; year: string },
    personId?: string | null,
    label?: string | null,
  ): Promise<PjnStartResult> {
    return createPjn(userId, input, personId, "ACTIVE", label);
  }

  /** Older flow: the case waits for confirmation on its tab (kept for existing rows and tests). */
  async function startPjn(
    userId: string,
    input: { jurisdiction: string; number: string; year: string },
    personId?: string | null,
  ): Promise<PjnStartResult> {
    return createPjn(userId, input, personId, "PENDING_CONFIRMATION");
  }

  /** The user confirmed the case is theirs: it becomes active and is fully parsed next. */
  async function confirmPjn(userId: string, trackerId: string): Promise<boolean> {
    const result = await prisma.tracker.updateMany({
      where: { id: trackerId, userId, kind: "PJN", status: "PENDING_CONFIRMATION" },
      data: { status: "ACTIVE", nextCheckAt: now() },
    });
    return result.count === 1;
  }

  /** Support/admin only (not exposed to users). */
  async function remove(userId: string, trackerId: string): Promise<boolean> {
    const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, userId } });
    if (!tracker) return false;
    const result = await prisma.tracker.deleteMany({ where: { id: tracker.id, userId } });
    return result.count > 0;
  }

  /**
   * The only removal available to users: a court case found by mistake that
   * they have not confirmed yet (nothing but the carátula was read). Confirmed
   * cases can only be closed by support, otherwise adding/removing cases over
   * and over would bypass the subscription limits.
   */
  async function discardPending(userId: string, trackerId: string): Promise<boolean> {
    const result = await prisma.tracker.deleteMany({
      where: { id: trackerId, userId, status: "PENDING_CONFIRMATION" },
    });
    return result.count === 1;
  }

  /** Support/admin only (not exposed to users). */
  async function finish(userId: string, trackerId: string): Promise<boolean> {
    const result = await prisma.tracker.updateMany({
      where: { id: trackerId, userId, status: "ACTIVE" },
      data: { status: "FINISHED" },
    });
    return result.count === 1;
  }

  async function applyResult(
    tracker: Tracker,
    data: { header: TrackerHeaderFields; steps: TrackerStep[]; finished: boolean },
  ): Promise<void> {
    const hash = contentHash(data.header, data.steps);
    const previous = await prisma.trackerSnapshot.findUnique({ where: { trackerId: tracker.id } });
    const known = new Set(((previous?.steps ?? []) as unknown as TrackerStep[]).map(stepKey));
    const newSteps = data.steps.filter((step) => !known.has(stepKey(step)));

    const operations: Prisma.PrismaPromise<unknown>[] = [
      prisma.trackerSnapshot.upsert({
        where: { trackerId: tracker.id },
        create: {
          trackerId: tracker.id,
          header: asJson(data.header),
          steps: asJson(data.steps),
          contentHash: hash,
        },
        update: { header: asJson(data.header), steps: asJson(data.steps), contentHash: hash },
      }),
      prisma.tracker.update({
        where: { id: tracker.id },
        data: {
          lastCheckedAt: now(),
          nextCheckAt: new Date(now().getTime() + TRACKER_CONFIG.checkIntervalHours * HOUR_MS),
          lastError: null,
          status: data.finished ? "FINISHED" : "ACTIVE",
        },
      }),
    ];
    // The source reports the case as completed: tell the owner the slot is free again.
    if (data.finished && tracker.status !== "FINISHED") {
      const owner = await prisma.user.findUnique({
        where: { id: tracker.userId },
        select: { telegramId: true, locale: true, subscriptionUntil: true },
      });
      if (owner?.telegramId != null && owner.subscriptionUntil && owner.subscriptionUntil > now()) {
        operations.push(
          prisma.telegramOutbox.create({
            data: {
              telegramId: owner.telegramId,
              kind: "case_finished",
              locale: owner.locale,
              payload: { caseId: caseIdentifier(tracker.kind as TrackerKindValue, tracker.reference, data.header) },
            },
          }),
        );
      }
    }
    // A case with Telegram switched off stays silent, and its first report is held
    // back until it is switched on (next data refresh).
    const muted = !tracker.notifyTelegram;
    const base = now().getTime();
    const latest = data.steps.length ? data.steps[data.steps.length - 1]! : null;

    if (!tracker.initialNotified && !muted) {
      // "Case added" report: the latest stage right after the first read.
      const payload: EventPayload = { step: latest, header: data.header, initial: true };
      operations.push(
        prisma.trackerEvent.create({
          data: { trackerId: tracker.id, payload: asJson(payload), createdAt: new Date(base) },
        }),
        prisma.tracker.update({ where: { id: tracker.id }, data: { initialNotified: true } }),
      );
    } else {
      // The first snapshot is a baseline, not news. A court case confirmed after
      // its carátula-only snapshot is baselined too (it was never fully read).
      const previousSteps = (previous?.steps ?? []) as unknown as TrackerStep[];
      const baseline = previous === null || (tracker.kind === "PJN" && previousSteps.length === 0);
      const changed =
        previous !== null &&
        previous.contentHash !== hash &&
        isMeaningfulChange(
          { header: previous.header as TrackerHeaderFields, steps: previousSteps },
          { header: data.header, steps: data.steps },
        );
      if (!baseline && changed) {
        // One event per new stage, oldest first; timestamps keep their order.
        const steps: (TrackerStep | null)[] = newSteps.length
          ? newSteps.slice(-MAX_EVENTS_PER_CHECK)
          : [null];
        steps.forEach((step, index) => {
          const payload: EventPayload = { step, header: data.header };
          operations.push(
            prisma.trackerEvent.create({
              data: {
                trackerId: tracker.id,
                payload: asJson(payload),
                createdAt: new Date(base + index),
              },
            }),
          );
        });
      }
    }
    await prisma.$transaction(operations);
  }

  async function recordFailure(tracker: Tracker, error: unknown): Promise<void> {
    const code = error instanceof ScraperError ? error.code : "failed";
    await prisma.tracker.update({
      where: { id: tracker.id },
      data: {
        lastError: code,
        // "not found yet" is normal for a new number: check again on the regular cadence
        nextCheckAt: new Date(
          now().getTime() +
            (code === "not_found"
              ? TRACKER_CONFIG.checkIntervalHours * HOUR_MS
              : TRACKER_CONFIG.retryAfterMinutes * 60_000),
        ),
      },
    });
  }

  async function checkTramite(tracker: Tracker): Promise<void> {
    try {
      const part =
        tracker.kind === "RENAPER"
          ? await scraper.renaper(tracker.reference)
          : await scraper.correo(tracker.reference);
      await applyResult(tracker, { header: part.header, steps: part.steps, finished: part.finished });
    } catch (error) {
      await recordFailure(tracker, error);
    }
  }

  async function checkPjn(tracker: Tracker): Promise<void> {
    const ref = parsePjnReference(tracker.reference);
    if (!ref) return recordFailure(tracker, new ScraperError("bad_reference"));
    try {
      const result = await scraper.pjnCase(ref);
      await applyResult(tracker, {
        header: { ...result.header },
        steps: (result.actuaciones ?? []).map((row) => ({
          date: row.fecha,
          title: row.tipo,
          detail: row.detalle,
        })),
        finished: false,
      });
    } catch (error) {
      await recordFailure(tracker, error);
    }
  }

  /** Checks trackers whose time has come (called by the worker on a timer). */
  async function runDue(limit: number = TRACKER_CONFIG.batchSize): Promise<number> {
    const due = await prisma.tracker.findMany({
      where: {
        status: "ACTIVE",
        ...ownerOnly,
        nextCheckAt: { lte: now() },
        // no paid access and the trial is over: tracking is paused
        user: {
          OR: [
            { subscriptionUntil: { gt: now() } },
            { trialStartedAt: { gt: new Date(now().getTime() - APP_CONFIG.limits.trialDays * 86_400_000) } },
          ],
        },
      },
      orderBy: { nextCheckAt: "asc" },
      take: limit,
    });
    const handled = new Set<string>();
    let checked = 0;
    for (const tracker of due) {
      if (handled.has(tracker.id)) continue;
      handled.add(tracker.id);
      if (tracker.kind === "PJN") await checkPjn(tracker);
      else await checkTramite(tracker);
      checked += 1;
    }
    return checked;
  }

  /**
   * Unsent events of users who linked Telegram and kept this service enabled.
   * Returned events are claimed: concurrent callers get different events.
   */
  async function pendingNotifications(limit = 50): Promise<PendingNotification[]> {
    const staleBefore = new Date(now().getTime() - CLAIM_TIMEOUT_MS);
    const events = await prisma.trackerEvent.findMany({
      where: {
        tracker: ownerOnly,
        notifiedAt: null,
        OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      include: {
        tracker: { include: { person: true, user: true } },
      },
    });
    const order = SERVICE_GROUPS.flatMap((group) => group.items.map((item) => item.section as string));
    const entries: {
      item: PendingNotification;
      relative: boolean;
      addedAt: number;
      section: number;
      createdAt: number;
    }[] = [];
    for (const event of events) {
      const { tracker } = event;
      const { user } = tracker;
      const section = TRACKER_KIND_SECTION[tracker.kind as TrackerKindValue];
      if (user.telegramId === null || !tracker.notifyTelegram) {
        // Nobody to tell: close the event so it does not pile up.
        await prisma.trackerEvent.update({ where: { id: event.id }, data: { notifiedAt: now() } });
        continue;
      }
      // Atomic claim: another worker may have taken this event meanwhile.
      const claim = await prisma.trackerEvent.updateMany({
        where: {
          id: event.id,
          notifiedAt: null,
          OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
        },
        data: { claimedAt: now() },
      });
      if (claim.count !== 1) continue;
      entries.push({
        relative: tracker.person !== null,
        addedAt: tracker.person?.createdAt.getTime() ?? 0,
        section: order.indexOf(section),
        createdAt: event.createdAt.getTime(),
        item: {
        eventId: event.id,
        telegramId: user.telegramId,
        locale: user.locale,
        kind: tracker.kind as TrackerKindValue,
        who: tracker.person
          ? `${tracker.person.firstName} ${tracker.person.lastName}`
          : [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
        caseId: caseIdentifier(
          tracker.kind as TrackerKindValue,
          tracker.reference,
          (event.payload as unknown as EventPayload).header ?? {},
        ),
        label: tracker.label,
        reference: tracker.reference,
        payload: event.payload as unknown as EventPayload,
        },
      });
    }
    // The owner's updates first, then each relative's (in the order they were
    // added); inside a person by menu order. Updates of one case keep their time order.
    entries.sort(
      (a, b) =>
        Number(a.relative) - Number(b.relative) ||
        a.addedAt - b.addedAt ||
        a.section - b.section ||
        a.createdAt - b.createdAt,
    );
    return entries.map((entry) => entry.item);
  }

  /**
   * Latest stage of every case, in the order of the left menu (DNI first, then
   * citizenship; owner before relatives). Sent once when Telegram is linked.
   */
  async function latestSteps(userId: string): Promise<DigestItem[]> {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(" ") || null;
    const rows = await prisma.tracker.findMany({
      where: {
        userId,
        ...ownerOnly,
        status: { notIn: ["PENDING_CONFIRMATION", "PAUSED"] },
        // cases switched off for Telegram are left out of the digest
        notifyTelegram: true,
      },
      include: { snapshot: true, person: true },
    });
    const order = SERVICE_GROUPS.flatMap((group) => group.items.map((item) => item.section as string));
    const sorted = rows
      .map((row) => {
        const kind = row.kind as TrackerKindValue;
        const steps = (row.snapshot?.steps ?? []) as unknown as TrackerStep[];
        const item: DigestItem = {
          kind,
          section: TRACKER_KIND_SECTION[kind] as string,
          who: row.person ? `${row.person.firstName} ${row.person.lastName}` : ownerName,
          isRelative: row.person !== null,
          caseId: caseIdentifier(
            kind,
            row.reference,
            (row.snapshot?.header ?? {}) as TrackerHeaderFields,
          ),
          header: (row.snapshot?.header ?? {}) as TrackerHeaderFields,
          step: steps.length ? steps[steps.length - 1]! : null,
        };
        return { item, personAddedAt: row.person?.createdAt.getTime() ?? 0 };
      })
      // the owner first (menu order), then each relative in the order they were added
      .sort(
        (a, b) =>
          Number(a.item.isRelative) - Number(b.item.isRelative) ||
          a.personAddedAt - b.personAddedAt ||
          order.indexOf(a.item.section) - order.indexOf(b.item.section),
      );
    return sorted.map((entry) => entry.item);
  }

  async function markNotified(eventId: string): Promise<void> {
    await prisma.trackerEvent.updateMany({
      where: { id: eventId, notifiedAt: null },
      data: { notifiedAt: now() },
    });
  }

  return {
    list,
    addTramite,
    findPjnByProfile,
    previewPjn,
    addPjn,
    startPjn,
    confirmPjn,
    replaceNumber,
    setLabel,
    setNotify,
    releaseCase,
    discardPending,
    remove,
    finish,
    runDue,
    pendingNotifications,
    latestSteps,
    markNotified,
  };
}

export type TrackerService = ReturnType<typeof createTrackerService>;
