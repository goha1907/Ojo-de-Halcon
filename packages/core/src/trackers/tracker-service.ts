import { createHash } from "node:crypto";
import type { Prisma, PrismaClient, Tracker, TrackerKind, TrackerSnapshot } from "@ojo/db";
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
import { keyedHash } from "../crypto";
import { resolveAccess } from "../access/access-service";
import { ScraperError, type Scraper } from "./scraper";

export interface TrackerDto {
  id: string;
  kind: TrackerKindValue;
  reference: string;
  label: string | null;
  status: TrackerStatusValue;
  /** Relative the case belongs to; null = the account owner. */
  person: { id: string; name: string } | null;
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
  | "SECTION_BUSY"
  | "SUBSCRIPTION_REQUIRED"
  | "PERSON_NOT_FOUND";

export type AddResult =
  | { ok: true; tracker: TrackerDto }
  | { ok: false; reason: AddFailure };

export type PjnStartResult =
  | { ok: true; tracker: TrackerDto }
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
  personName: string | null;
  header: TrackerHeaderFields;
  /** Most recent stage, or null when none is known yet. */
  step: TrackerStep | null;
}

export interface PendingNotification {
  eventId: string;
  telegramId: bigint;
  locale: string;
  kind: TrackerKindValue;
  label: string | null;
  reference: string;
  payload: EventPayload;
}

/** Upper bound of separate messages produced by one check (protects against floods). */
const MAX_EVENTS_PER_CHECK = 10;
const HOUR_MS = 3_600_000;
/** A claimed notification that was never confirmed is retried after this time. */
const CLAIM_TIMEOUT_MS = 5 * 60_000;

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

export function createTrackerService(deps: {
  prisma: PrismaClient;
  scraper: Scraper;
  now: () => Date;
  /** Pepper for the trial ledger hashes. */
  secret: string;
}) {
  const { prisma, scraper, now, secret } = deps;

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
      person: tracker.person
        ? { id: tracker.person.id, name: `${tracker.person.firstName} ${tracker.person.lastName}` }
        : null,
      header: (tracker.snapshot?.header ?? {}) as TrackerHeaderFields,
      steps: (tracker.snapshot?.steps ?? []) as unknown as TrackerStep[],
      lastCheckedAt: tracker.lastCheckedAt ? tracker.lastCheckedAt.toISOString() : null,
      lastError: tracker.lastError,
    };
  }

  async function list(userId: string): Promise<TrackerDto[]> {
    const rows = await prisma.tracker.findMany({
      where: { userId },
      include: { snapshot: true, person: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDto);
  }

  /** One case per section: a user may not hold a second unfinished tracker of a kind. */
  async function sectionBusy(
    userId: string,
    personKey: string,
    kind: TrackerKind,
    reference: string,
  ): Promise<boolean> {
    const other = await prisma.tracker.findFirst({
      where: { userId, personKey, kind, status: { not: "FINISHED" }, reference: { not: reference } },
    });
    return other !== null;
  }

  /** The person must belong to the user; null/undefined means the owner. */
  async function resolvePerson(
    userId: string,
    personId: string | null | undefined,
  ): Promise<{ ok: true; personId: string | null; personKey: string } | { ok: false }> {
    if (!personId) return { ok: true, personId: null, personKey: "self" };
    const person = await prisma.person.findFirst({ where: { id: personId, userId } });
    return person ? { ok: true, personId: person.id, personKey: person.id } : { ok: false };
  }

  /**
   * Access rule. A subscription allows everything; without one the free trial
   * covers a single case, so any other case needs a subscription.
   */
  async function mayAdd(userId: string): Promise<boolean> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { trialStartedAt: true, subscriptionUntil: true },
    });
    const access = resolveAccess(user, now());
    if (access.plan === "subscription") return true;
    if (access.plan === "trial_expired") return false;
    // the trial covers exactly one case in total
    const open = await prisma.tracker.count({ where: { userId, status: { not: "FINISHED" } } });
    return open === 0;
  }

  const ledgerKey = (value: string) => keyedHash(secret, "ledger", value);

  /** Starts the trial at the first tracker and remembers it for the mailbox. */
  async function startTrial(userId: string): Promise<void> {
    const started = await prisma.user.updateMany({
      where: { id: userId, trialStartedAt: null },
      data: { trialStartedAt: now() },
    });
    if (started.count === 0) return;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { emailCanonical: true, trialStartedAt: true },
    });
    await prisma.trialLedger.upsert({
      where: { keyHash: ledgerKey(`email:${user.emailCanonical}`) },
      create: {
        keyHash: ledgerKey(`email:${user.emailCanonical}`),
        kind: "email",
        trialStartedAt: user.trialStartedAt,
      },
      update: {},
    });
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
  ): Promise<AddResult> {
    const person = await resolvePerson(userId, personId);
    if (!person.ok) return { ok: false, reason: "PERSON_NOT_FOUND" };
    const { personKey } = person;
    const existing = await prisma.tracker.findFirst({
      where: { userId, personKey, kind, reference, status: { not: "FINISHED" } },
    });
    if (existing) return { ok: false, reason: "ALREADY_EXISTS" };
    if (await sectionBusy(userId, personKey, kind, reference)) return { ok: false, reason: "SECTION_BUSY" };
    if (!(await mayAdd(userId))) return { ok: false, reason: "SUBSCRIPTION_REQUIRED" };

    const tracker = await prisma.tracker.upsert({
      where: { userId_personKey_kind_reference: { userId, personKey, kind, reference } },
      create: { userId, personId: person.personId, personKey, kind, reference, nextCheckAt: now() },
      update: { status: "ACTIVE", nextCheckAt: now(), lastError: null },
    });
    await startTrial(userId);
    const full = await prisma.tracker.findUniqueOrThrow({
      where: { id: tracker.id },
      include: { snapshot: true, person: true },
    });
    return { ok: true, tracker: toDto(full) };
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

  /**
   * First step of adding a court case: only the header (carátula) is parsed and
   * the tracker waits for the user's confirmation before anything else is read.
   */
  async function startPjn(
    userId: string,
    input: { jurisdiction: string; number: string; year: string },
    personId?: string | null,
  ): Promise<PjnStartResult> {
    const person = await resolvePerson(userId, personId);
    if (!person.ok) return { ok: false, reason: "PERSON_NOT_FOUND" };
    const { personKey } = person;
    const reference = pjnReference(input);
    const existing = await prisma.tracker.findUnique({
      where: { userId_personKey_kind_reference: { userId, personKey, kind: "PJN", reference } },
    });
    if (existing && existing.status !== "FINISHED") return { ok: false, reason: "ALREADY_EXISTS" };
    if (await sectionBusy(userId, personKey, "PJN", reference)) return { ok: false, reason: "SECTION_BUSY" };
    if (!(await mayAdd(userId))) return { ok: false, reason: "SUBSCRIPTION_REQUIRED" };

    let header: TrackerHeaderFields;
    try {
      const result = await scraper.pjnCase({ ...input, headerOnly: true });
      header = { ...result.header };
    } catch (error) {
      const notFound = error instanceof ScraperError && error.code === "not_found";
      return { ok: false, reason: notFound ? "NOT_FOUND" : "SOURCE_DOWN" };
    }

    const tracker = await prisma.tracker.upsert({
      where: { userId_personKey_kind_reference: { userId, personKey, kind: "PJN", reference } },
      create: {
        userId,
        personId: person.personId,
        personKey,
        kind: "PJN",
        reference,
        status: "PENDING_CONFIRMATION",
        lastCheckedAt: now(),
      },
      update: { status: "PENDING_CONFIRMATION", lastError: null, lastCheckedAt: now() },
    });
    await prisma.trackerSnapshot.upsert({
      where: { trackerId: tracker.id },
      create: { trackerId: tracker.id, header: asJson(header), steps: [], contentHash: contentHash(header, []) },
      update: { header: asJson(header), steps: [], contentHash: contentHash(header, []) },
    });
    await startTrial(userId);
    const full = await prisma.tracker.findUniqueOrThrow({
      where: { id: tracker.id },
      include: { snapshot: true, person: true },
    });
    return { ok: true, tracker: toDto(full) };
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
    // Who hears about this case: a muted relative stays silent, and the owner's
    // first report is held back until the person is unmuted (next data refresh).
    const owner = tracker.personId
      ? await prisma.person.findUnique({ where: { id: tracker.personId }, select: { notifyTelegram: true } })
      : null;
    const muted = owner !== null && !owner.notifyTelegram;
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
      if (!baseline && previous.contentHash !== hash) {
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
        notifiedAt: null,
        OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      include: {
        tracker: { include: { person: true, user: { include: { servicePrefs: true } } } },
      },
    });
    const result: PendingNotification[] = [];
    for (const event of events) {
      const { tracker } = event;
      const { user } = tracker;
      const section = TRACKER_KIND_SECTION[tracker.kind as TrackerKindValue];
      const pref = user.servicePrefs.find((row) => row.serviceKey === section);
      const enabled = pref ? pref.enabled : true;
      const mutedPerson = tracker.person !== null && !tracker.person.notifyTelegram;
      if (user.telegramId === null || !enabled || mutedPerson) {
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
      result.push({
        eventId: event.id,
        telegramId: user.telegramId,
        locale: user.locale,
        kind: tracker.kind as TrackerKindValue,
        label: tracker.person
          ? `${tracker.person.firstName} ${tracker.person.lastName}`
          : tracker.label,
        reference: tracker.reference,
        payload: event.payload as unknown as EventPayload,
      });
    }
    return result;
  }

  /**
   * Latest stage of every case, in the order of the left menu (DNI first, then
   * citizenship; owner before relatives). Sent once when Telegram is linked.
   */
  async function latestSteps(userId: string): Promise<DigestItem[]> {
    const rows = await prisma.tracker.findMany({
      where: {
        userId,
        status: { not: "PENDING_CONFIRMATION" },
        // relatives muted by the owner are left out of Telegram
        OR: [{ personId: null }, { person: { notifyTelegram: true } }],
      },
      include: { snapshot: true, person: true },
    });
    const order = SERVICE_GROUPS.flatMap((group) => group.items.map((item) => item.section as string));
    const items = rows.map((row) => {
      const kind = row.kind as TrackerKindValue;
      const steps = (row.snapshot?.steps ?? []) as unknown as TrackerStep[];
      return {
        kind,
        section: TRACKER_KIND_SECTION[kind] as string,
        personName: row.person ? `${row.person.firstName} ${row.person.lastName}` : null,
        header: (row.snapshot?.header ?? {}) as TrackerHeaderFields,
        step: steps.length ? steps[steps.length - 1]! : null,
      };
    });
    const rank = (item: DigestItem) => [order.indexOf(item.section), item.personName === null ? 0 : 1] as const;
    return items.sort((a, b) => {
      const [sa, pa] = rank(a);
      const [sb, pb] = rank(b);
      return sa - sb || pa - pb || (a.personName ?? "").localeCompare(b.personName ?? "");
    });
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
    startPjn,
    confirmPjn,
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
