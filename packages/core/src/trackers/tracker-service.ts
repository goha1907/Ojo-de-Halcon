import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient, Tracker, TrackerKind, TrackerSnapshot } from "@ojo/db";
import {
  LINKED_TRAMITE_KINDS,
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
  /** Kind of the twin tracker created from the same trámite number. */
  linkedKind: TrackerKindValue | null;
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

type AddFailure = "ALREADY_EXISTS" | "SECTION_BUSY" | "SUBSCRIPTION_REQUIRED" | "PERSON_NOT_FOUND";

export type AddResult =
  | { ok: true; tracker: TrackerDto; alsoCreated: TrackerKindValue | null }
  | { ok: false; reason: AddFailure };

export type PjnStartResult =
  | { ok: true; tracker: TrackerDto }
  | { ok: false; reason: AddFailure | "NOT_FOUND" | "SOURCE_DOWN" };

export type PjnSearchResult =
  | { ok: true; candidates: PjnCandidate[] }
  | { ok: false; reason: "PROFILE_INCOMPLETE" | "NO_COURT" | "SOURCE_DOWN" | "PERSON_NOT_FOUND" };

export interface EventPayload {
  /** Stages that appeared since the previous check (at most a few). */
  newSteps: TrackerStep[];
  header: TrackerHeaderFields;
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

const MAX_STEPS_IN_EVENT = 5;
const HOUR_MS = 3_600_000;

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

function otherLinkedKind(kind: TrackerKindValue): TrackerKindValue | null {
  return (LINKED_TRAMITE_KINDS as readonly string[]).includes(kind)
    ? (LINKED_TRAMITE_KINDS.find((item) => item !== kind) ?? null)
    : null;
}

export function createTrackerService(deps: {
  prisma: PrismaClient;
  scraper: Scraper;
  now: () => Date;
}) {
  const { prisma, scraper, now } = deps;

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
      linkedKind: tracker.linkGroupId ? otherLinkedKind(kind) : null,
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
   * covers a single case (a RENAPER + Correo pair counts as one), so any other
   * case needs a subscription.
   */
  async function mayAdd(
    userId: string,
    personKey: string,
    kind: TrackerKindValue,
    reference: string,
  ): Promise<boolean> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { trialStartedAt: true, subscriptionUntil: true },
    });
    const access = resolveAccess(user, now());
    if (access.plan === "subscription") return true;
    if (access.plan === "trial_expired") return false;
    const open = await prisma.tracker.findMany({
      where: { userId, status: { not: "FINISHED" } },
      select: { personKey: true, kind: true, reference: true, linkGroupId: true, id: true },
    });
    if (open.length === 0) return true;
    // the twin of the case already being tracked is the same case
    const isTwin =
      (LINKED_TRAMITE_KINDS as readonly string[]).includes(kind) &&
      open.some(
        (item) =>
          item.personKey === personKey &&
          item.reference === reference &&
          (LINKED_TRAMITE_KINDS as readonly string[]).includes(item.kind),
      );
    return isTwin;
  }

  async function startTrial(userId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { id: userId, trialStartedAt: null },
      data: { trialStartedAt: now() },
    });
  }

  /**
   * Adds a trámite number. RENAPER and Correo share the number, so both
   * trackers are created together (`alsoCreated` tells which twin was added).
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
    for (const item of LINKED_TRAMITE_KINDS) {
      if (await sectionBusy(userId, personKey, item, reference)) return { ok: false, reason: "SECTION_BUSY" };
    }
    if (!(await mayAdd(userId, personKey, kind, reference))) {
      return { ok: false, reason: "SUBSCRIPTION_REQUIRED" };
    }

    const linkGroupId = randomUUID();
    const created: Tracker[] = [];
    for (const item of LINKED_TRAMITE_KINDS) {
      const tracker = await prisma.tracker.upsert({
        where: { userId_personKey_kind_reference: { userId, personKey, kind: item, reference } },
        create: {
          userId,
          personId: person.personId,
          personKey,
          kind: item,
          reference,
          linkGroupId,
          nextCheckAt: now(),
        },
        update: { linkGroupId, status: "ACTIVE", nextCheckAt: now(), lastError: null },
      });
      created.push(tracker);
    }
    await startTrial(userId);
    const main = created.find((tracker) => tracker.kind === kind)!;
    const full = await prisma.tracker.findUniqueOrThrow({
      where: { id: main.id },
      include: { snapshot: true, person: true },
    });
    return { ok: true, tracker: toDto(full), alsoCreated: otherLinkedKind(kind) };
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
      const rows = await scraper.pjnParty({
        jurisdiction: user.pjnJurisdiction,
        name: user.lastName,
      });
      const candidates: PjnCandidate[] = [];
      for (const row of rows) {
        if (!caratulaMatchesName(row.caratula, user.firstName, user.lastName)) continue;
        const parsed = parseExpediente(row.expediente);
        if (!parsed) continue;
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
    if (!(await mayAdd(userId, personKey, "PJN", reference))) {
      return { ok: false, reason: "SUBSCRIPTION_REQUIRED" };
    }

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

  async function remove(userId: string, trackerId: string): Promise<boolean> {
    const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, userId } });
    if (!tracker) return false;
    // A trámite pair is removed together: the number is shared by both tabs.
    const ids = tracker.linkGroupId
      ? (
          await prisma.tracker.findMany({
            where: { userId, linkGroupId: tracker.linkGroupId },
            select: { id: true },
          })
        ).map((row) => row.id)
      : [tracker.id];
    const result = await prisma.tracker.deleteMany({ where: { id: { in: ids }, userId } });
    return result.count > 0;
  }

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
    // The very first snapshot is the baseline, not news.
    const changed = previous !== null && previous.contentHash !== hash;
    if (changed) {
      const payload: EventPayload = {
        newSteps: newSteps.slice(-MAX_STEPS_IN_EVENT),
        header: data.header,
      };
      operations.push(
        prisma.trackerEvent.create({ data: { trackerId: tracker.id, payload: asJson(payload) } }),
      );
    }
    await prisma.$transaction(operations);
  }

  async function recordFailure(tracker: Tracker, error: unknown): Promise<void> {
    const code = error instanceof ScraperError ? error.code : "failed";
    await prisma.tracker.update({
      where: { id: tracker.id },
      data: {
        lastError: code,
        nextCheckAt: new Date(now().getTime() + TRACKER_CONFIG.retryAfterMinutes * 60_000),
      },
    });
  }

  async function checkTramite(tracker: Tracker, handled: Set<string>): Promise<void> {
    const twins = await prisma.tracker.findMany({
      where: {
        userId: tracker.userId,
        personKey: tracker.personKey,
        reference: tracker.reference,
        kind: { in: [...LINKED_TRAMITE_KINDS] },
        status: "ACTIVE",
      },
    });
    for (const twin of twins) handled.add(twin.id);
    try {
      const result = await scraper.tramite(tracker.reference);
      for (const twin of twins) {
        const part = twin.kind === "RENAPER" ? result.renaper : result.correo;
        await applyResult(twin, {
          header: part.header,
          steps: part.steps,
          finished: part.finished,
        });
      }
    } catch (error) {
      for (const twin of twins) await recordFailure(twin, error);
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
      else await checkTramite(tracker, handled);
      checked += 1;
    }
    return checked;
  }

  /** Unsent events of users who linked Telegram and kept this service enabled. */
  async function pendingNotifications(limit = 50): Promise<PendingNotification[]> {
    const events = await prisma.trackerEvent.findMany({
      where: { notifiedAt: null },
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
      if (user.telegramId === null || !enabled) {
        // Nobody to tell: close the event so it does not pile up.
        await prisma.trackerEvent.update({ where: { id: event.id }, data: { notifiedAt: now() } });
        continue;
      }
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
    remove,
    finish,
    runDue,
    pendingNotifications,
    markNotified,
  };
}

export type TrackerService = ReturnType<typeof createTrackerService>;
