import { createHash } from "node:crypto";
import type { Prisma, PrismaClient, Tracker, TrackerSnapshot } from "@ojo/db";
import {
  SERVICE_GROUPS,
  APP_CONFIG,
  TRACKER_CONFIG,
  TRACKER_KIND_SECTION,
  caratulaMatchesName,
  findJurisdiction,
  isDnmKind,
  isFinalStatus,
  normalizeCorreoReference,
  parseExpediente,
  parsePjnReference,
  pjnReference,
  type TrackerHeaderFields,
  type TrackerKindValue,
  type TrackerStatusValue,
  type TrackerStep,
} from "@ojo/shared";
import type { CapacityService } from "../capacity/capacity-service";
import type { GrantService } from "../grants/grant-service";
import { ScraperError, type Scraper, type ScrapedTramite } from "./scraper";

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
  /** Birth date the case is checked with (Migraciones kinds), ISO; null = the profile's. */
  holderBirthDate: string | null;
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
  /** The court registry already shows it as closed (archived). */
  closed: boolean;
}

type AddFailure =
  | "ALREADY_EXISTS"
  | "NO_FREE_SLOT"
  | "BIRTH_DATE_REQUIRED"
  | "SUBSCRIPTION_REQUIRED"
  | "MISMATCH";

export type AddResult =
  | { ok: true; tracker: TrackerDto }
  | { ok: false; reason: AddFailure };

export type PjnStartResult =
  | { ok: true; tracker: TrackerDto }
  | { ok: false; reason: AddFailure | "NOT_FOUND" | "SOURCE_DOWN" };

export type TramitePreviewResult =
  | { ok: true; header: TrackerHeaderFields }
  | { ok: false; reason: AddFailure | "SOURCE_DOWN" };

export type PjnPreviewResult =
  | { ok: true; header: TrackerHeaderFields }
  | { ok: false; reason: AddFailure | "NOT_FOUND" | "SOURCE_DOWN" };

export type PjnSearchResult =
  | { ok: true; candidates: PjnCandidate[] }
  | { ok: false; reason: "PROFILE_INCOMPLETE" | "NO_COURT" | "SOURCE_DOWN" };

/** One notification = one change. A check that finds several new stages creates several events. */
export interface EventPayload {
  /** The stage that appeared; null when only the status in the header changed. */
  step: TrackerStep | null;
  header: TrackerHeaderFields;
  /** "Case added": the first report of a case, showing its latest stage. */
  initial?: boolean;
  /**
   * Telegram was on for the case when the change was found. Kept with the event, so the last
   * report of a case that finishes is still delivered after its switches are turned off.
   */
  notify?: boolean;
}

/** Latest known stage of one case, for the digest sent when Telegram gets linked. */
export interface DigestItem {
  kind: TrackerKindValue;
  section: string;
  /** Whose account it is (null when unknown). */
  who: string | null;
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
  /** Whose account it is (null when unknown). */
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

/** Header field holding the state of a case, per kind (the stage titles are recorded as well). */
const STATE_FIELD: Partial<Record<TrackerKindValue, string>> = {
  DNM_DNI: "state",
  DNM_CITIZENSHIP: "status",
  RENAPER: "status",
  PJN: "sit_actual",
};
const OBSERVATION_MAX_LENGTH = 200;

/** Does the read case show a final status of its kind (the state field, or the latest Correo stage)? */
function reachedFinalStatus(
  kind: TrackerKindValue,
  data: { header: TrackerHeaderFields; steps: TrackerStep[] },
): boolean {
  const field = STATE_FIELD[kind];
  if (field && isFinalStatus(kind, data.header[field])) return true;
  const latest = data.steps[data.steps.length - 1];
  return kind === "CORREO" && latest !== undefined && isFinalStatus(kind, latest.title);
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
  grants: GrantService;
  capacity: CapacityService;
}) {
  const { prisma, scraper, now, grants, capacity } = deps;

  type TrackerWithSnapshot = Tracker & { snapshot: TrackerSnapshot | null };

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
      holderBirthDate: tracker.holderBirthDate ? tracker.holderBirthDate.toISOString().slice(0, 10) : null,
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
      where: { userId },
      include: { snapshot: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDto);
  }

  /**
   * May one more case be tracked. The places are the paid ones of a running subscription plus the active
   * free ones (trial, bonus, gift); finished and paused cases do not occupy one.
   */
  async function addGate(userId: string): Promise<"OK" | "NO_FREE_SLOT" | "SUBSCRIPTION_REQUIRED"> {
    const places = await capacity.get(userId);
    if (places.total === 0) return "SUBSCRIPTION_REQUIRED";
    const occupied = await prisma.tracker.count({
      where: { userId, status: { notIn: ["FINISHED", "PAUSED"] } },
    });
    if (occupied < places.total) return "OK";
    // the places are full: more paid ones fix it for a subscriber, an account without one needs a subscription
    return places.running ? "NO_FREE_SLOT" : "SUBSCRIPTION_REQUIRED";
  }

  /** Runs a create; null when another request just added the very same case (unique key). */
  async function createUnique<T>(create: () => Promise<T>): Promise<T | null> {
    try {
      return await create();
    } catch (error) {
      if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") return null;
      throw error;
    }
  }

  /** The date Migraciones is asked with (DD/MM/YYYY): the case's own, else the owner's profile. */
  async function dnmBirthDate(tracker: Tracker): Promise<string | null> {
    const date =
      tracker.holderBirthDate ??
      (await prisma.user.findUnique({ where: { id: tracker.userId }, select: { birthDate: true } }))?.birthDate;
    if (!date) return null;
    const iso = date.toISOString().slice(0, 10);
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  }

  /**
   * Adds a trámite number to one source. RENAPER and Correo are independent:
   * a person may wait for the DNI at either one or both, so each is added on
   * its own (and counts as its own case).
   */
  async function addTramite(
    userId: string,
    kind: Exclude<TrackerKindValue, "PJN">,
    reference: string,
    label?: string | null,
    birthDate?: Date | null,
  ): Promise<AddResult> {
    // Migraciones verifies the number together with the holder's birth date: the one
    // typed when adding, or else the holder's profile.
    let holderBirthDate: Date | null = null;
    if (isDnmKind(kind)) {
      holderBirthDate =
        birthDate ??
        (await prisma.user.findUnique({ where: { id: userId }, select: { birthDate: true } }))?.birthDate ??
        null;
      if (!holderBirthDate) return { ok: false, reason: "BIRTH_DATE_REQUIRED" };
    }
    const existing = await prisma.tracker.findFirst({
      where: { userId, kind, reference },
    });
    if (existing) return { ok: false, reason: "ALREADY_EXISTS" };
    const remembered = takeRead(userId, kind, reference, holderBirthDate);
    // a case that is already closed occupies no slot, so no free slot is needed to keep it in the history
    const closed = remembered !== null && (remembered.finished || reachedFinalStatus(kind, remembered));
    if (!closed) {
      const gate = await addGate(userId);
      if (gate !== "OK") return { ok: false, reason: gate };
    }
    const tracker = await createUnique(() =>
      prisma.tracker.create({
        data: { userId, kind, reference, label: label ?? null, holderBirthDate, nextCheckAt: now() },
      }),
    );
    if (!tracker) return { ok: false, reason: "ALREADY_EXISTS" };
    // the case was read in the preview step: store that read now, so the card is filled at once
    if (remembered) {
      // added already closed: no "your case is finished" notice for something the user just saw
      await applyResult(
        tracker,
        { header: remembered.header, steps: remembered.steps, finished: closed },
        { announceFinish: false },
      );
    }
    const full = await prisma.tracker.findUniqueOrThrow({
      where: { id: tracker.id },
      include: { snapshot: true },
    });
    return { ok: true, tracker: toDto(full) };
  }

  /**
   * Step one of adding a trámite: asks the source and returns only what identifies the case
   * (and whether it is already closed). The stages stay hidden until the user confirms. A
   * closed case takes no slot; an open one needs a free slot (or the trial).
   */
  async function previewTramite(
    userId: string,
    kind: Exclude<TrackerKindValue, "PJN">,
    reference: string,
    birthDate?: Date | null,
  ): Promise<TramitePreviewResult> {
    const existing = await prisma.tracker.findFirst({
      where: { userId, kind, reference },
    });
    if (existing) return { ok: false, reason: "ALREADY_EXISTS" };
    let holderBirthDate: Date | null = null;
    if (isDnmKind(kind)) {
      holderBirthDate =
        birthDate ??
        (await prisma.user.findUnique({ where: { id: userId }, select: { birthDate: true } }))?.birthDate ??
        null;
      if (!holderBirthDate) return { ok: false, reason: "BIRTH_DATE_REQUIRED" };
    }
    let result: ScrapedTramite;
    try {
      if (isDnmKind(kind) && holderBirthDate) {
        const iso = holderBirthDate.toISOString().slice(0, 10);
        result = await scraper.dnm({
          kind,
          number: reference,
          birthDate: `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`,
        });
      } else {
        result = kind === "RENAPER" ? await scraper.renaper(reference) : await scraper.correo(reference);
      }
    } catch (error) {
      if (error instanceof ScraperError && error.code === "mismatch") return { ok: false, reason: "MISMATCH" };
      // a number the source does not know yet is normal: it can still be added and is checked later
      if (error instanceof ScraperError && error.code === "not_found") {
        const gate = await addGate(userId);
        return gate === "OK" ? { ok: true, header: {} } : { ok: false, reason: gate };
      }
      return { ok: false, reason: "SOURCE_DOWN" };
    }
    const closed = result.finished || reachedFinalStatus(kind, result);
    if (!closed) {
      const gate = await addGate(userId);
      if (gate !== "OK") return { ok: false, reason: gate };
    }
    rememberRead(userId, kind, reference, holderBirthDate, result);
    const { header } = result;
    const identity: TrackerHeaderFields = {};
    if (closed) {
      identity.closed = "true";
      const state = isDnmKind(kind) ? header.state : header.status;
      if (state) identity.state = state;
    }
    if (result.holder) identity.holder = result.holder;
    for (const key of ["office", "nationality", "expediente", "type", "description"]) {
      if (header[key]) identity[key] = header[key]!;
    }
    return { ok: true, header: identity };
  }

  /** Reads made in the preview step, reused when the user confirms (no second request). */
  const reads = new Map<string, { result: ScrapedTramite; at: number }>();
  const readKey = (userId: string, kind: string, reference: string, birth: Date | null) =>
    `${userId}:${kind}:${reference}:${birth ? birth.toISOString().slice(0, 10) : ""}`;
  function rememberRead(userId: string, kind: string, reference: string, birth: Date | null, result: ScrapedTramite) {
    for (const [key, entry] of reads) {
      if (entry.at < now().getTime() - PREVIEW_TTL_MS) reads.delete(key);
    }
    reads.set(readKey(userId, kind, reference, birth), { result, at: now().getTime() });
  }
  function takeRead(userId: string, kind: string, reference: string, birth: Date | null): ScrapedTramite | null {
    const key = readKey(userId, kind, reference, birth);
    const entry = reads.get(key);
    reads.delete(key);
    return entry && entry.at >= now().getTime() - PREVIEW_TTL_MS ? entry.result : null;
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
    birthDate?: Date | null,
  ): Promise<"OK" | "NOT_ALLOWED" | "ALREADY_EXISTS"> {
    const tracker = await prisma.tracker.findFirst({
      where: { id: trackerId, userId, kind: { in: ["RENAPER", "CORREO", "DNM_DNI", "DNM_CITIZENSHIP"] }, status: "ACTIVE" },
      include: { snapshot: true },
    });
    if (!tracker || !replaceState(tracker, now()).canReplace) return "NOT_ALLOWED";
    // a Correo reference ("<form>:<…>") only fits a Correo slot, and a Correo slot takes only valid ones
    if (tracker.kind === "CORREO" ? normalizeCorreoReference(newReference) === null : newReference.includes(":")) {
      return "NOT_ALLOWED";
    }
    const duplicate = await prisma.tracker.findFirst({
      where: {
        userId,
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
          ...(birthDate && isDnmKind(tracker.kind) ? { holderBirthDate: birthDate } : {}),
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

  /** Anonymous tally of seen statuses and stages, most frequent first (for product analytics). */
  async function statusStats(kind?: TrackerKindValue) {
    return prisma.statusObservation.findMany({
      where: kind ? { kind } : {},
      orderBy: [{ kind: "asc" }, { field: "asc" }, { count: "desc" }],
    });
  }

  /** Searches the court registry by the profile name and keeps results that match it. */
  async function findPjnByProfile(userId: string): Promise<PjnSearchResult> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
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
            where: { userId, kind: "PJN" },
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
        rememberPreview(previewKey(userId, reference), {
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
          closed: isFinalStatus("PJN", row.situacion),
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
  const previewKey = (userId: string, reference: string) => `${userId}:${reference}`;
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
  ): Promise<{ ok: true; reference: string } | { ok: false; reason: AddFailure }> {
    const reference = pjnReference(input);
    const existing = await prisma.tracker.findUnique({
      where: { userId_kind_reference: { userId, kind: "PJN", reference } },
    });
    // the same case is never added twice, whatever state the first one is in (even finished)
    if (existing) return { ok: false, reason: "ALREADY_EXISTS" };
    return { ok: true, reference };
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
  ): Promise<PjnPreviewResult> {
    const checked = await pjnPreflight(userId, input);
    if (!checked.ok) return checked;
    const read = await readCaseHeader(input);
    if (!read.ok) return read;
    // a closed (archived) case takes no slot; an open one needs a free slot (or the trial)
    const closed = isFinalStatus("PJN", read.header.sit_actual);
    if (!closed) {
      const gate = await addGate(userId);
      if (gate !== "OK") return { ok: false, reason: gate };
    }
    rememberPreview(previewKey(userId, checked.reference), read.header);
    return { ok: true, header: closed ? { ...read.header, closed: "true" } : read.header };
  }

  async function createPjn(
    userId: string,
    input: { jurisdiction: string; number: string; year: string },
    status: "ACTIVE" | "PENDING_CONFIRMATION",
    label?: string | null,
  ): Promise<PjnStartResult> {
    const checked = await pjnPreflight(userId, input);
    if (!checked.ok) return checked;
    const { reference } = checked;
    let header = takePreview(previewKey(userId, reference));
    if (!header) {
      const read = await readCaseHeader(input);
      if (!read.ok) return read;
      header = read.header;
    }
    const closed = isFinalStatus("PJN", header.sit_actual);
    if (!closed) {
      const gate = await addGate(userId);
      if (gate !== "OK") return { ok: false, reason: gate };
    }
    const tracker = await createUnique(() =>
      prisma.tracker.create({
        data: {
          userId,
          kind: "PJN",
          reference,
          status,
          label: label ?? null,
          lastCheckedAt: now(),
          nextCheckAt: now(),
        },
      }),
    );
    if (!tracker) return { ok: false, reason: "ALREADY_EXISTS" };
    await prisma.trackerSnapshot.upsert({
      where: { trackerId: tracker.id },
      create: { trackerId: tracker.id, header: asJson(header), steps: [], contentHash: contentHash(header, []) },
      update: { header: asJson(header), steps: [], contentHash: contentHash(header, []) },
    });
    if (closed) {
      // an archived case: read it fully once for the history, then close it (no slot, no notices)
      await checkPjn(tracker, { announceFinish: false });
      await prisma.tracker.update({
        where: { id: tracker.id },
        data: { status: "FINISHED", notifyTelegram: false, notifyWhatsapp: false },
      });
    }
    const full = await prisma.tracker.findUniqueOrThrow({
      where: { id: tracker.id },
      include: { snapshot: true },
    });
    return { ok: true, tracker: toDto(full) };
  }

  /** Step two: the user saw the header and confirmed; the case is tracked from now on. */
  async function addPjn(
    userId: string,
    input: { jurisdiction: string; number: string; year: string },
    label?: string | null,
  ): Promise<PjnStartResult> {
    return createPjn(userId, input, "ACTIVE", label);
  }

  /** Older flow: the case waits for confirmation on its tab (kept for existing rows and tests). */
  async function startPjn(
    userId: string,
    input: { jurisdiction: string; number: string; year: string },
  ): Promise<PjnStartResult> {
    return createPjn(userId, input, "PENDING_CONFIRMATION");
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
      data: { status: "FINISHED", finishedAt: now() },
    });
    return result.count === 1;
  }

  async function applyResult(
    tracker: Tracker,
    data: { header: TrackerHeaderFields; steps: TrackerStep[]; finished: boolean },
    options: { announceFinish?: boolean } = {},
  ): Promise<void> {
    const hash = contentHash(data.header, data.steps);
    // a source may say a case is over by itself, or its status may be a final one (see FINAL_STATUSES)
    const finished = data.finished || reachedFinalStatus(tracker.kind as TrackerKindValue, data);
    const previous = await prisma.trackerSnapshot.findUnique({ where: { trackerId: tracker.id } });
    const known = new Set(((previous?.steps ?? []) as unknown as TrackerStep[]).map(stepKey));
    const newSteps = data.steps.filter((step) => !known.has(stepKey(step)));

    // Tally what appeared (anonymous): a new state of the case and every new stage title.
    const kind = tracker.kind as TrackerKindValue;
    const observed: { field: "status" | "step"; value: string }[] = [];
    const stateField = STATE_FIELD[kind];
    const state = stateField ? (data.header[stateField] ?? "").trim() : "";
    const previousHeader = (previous?.header ?? {}) as TrackerHeaderFields;
    if (state && (previous === null || previousHeader[stateField!] !== data.header[stateField!])) {
      observed.push({ field: "status", value: state });
    }
    for (const step of newSteps) {
      if (step.title.trim()) observed.push({ field: "step", value: step.title.trim() });
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [
      ...observed.map(({ field, value }) =>
        prisma.statusObservation.upsert({
          where: { kind_field_value: { kind, field, value: value.slice(0, OBSERVATION_MAX_LENGTH) } },
          create: { kind, field, value: value.slice(0, OBSERVATION_MAX_LENGTH) },
          update: { count: { increment: 1 }, lastSeenAt: now() },
        }),
      ),
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
          status: finished ? "FINISHED" : "ACTIVE",
          // a finished case is neither polled nor notified: its switches go off by themselves
          ...(finished ? { notifyTelegram: false, notifyWhatsapp: false } : {}),
          // the slot became free now (a case added already closed never held one)
          ...(finished && tracker.status !== "FINISHED" && options.announceFinish !== false
            ? { finishedAt: now() }
            : {}),
        },
      }),
    ];
    // The source reports the case as completed: tell the owner the slot is free again.
    if (finished && tracker.status !== "FINISHED" && options.announceFinish !== false) {
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
      const payload: EventPayload = {
        step: latest,
        header: data.header,
        initial: true,
        notify: tracker.notifyTelegram,
      };
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
          const payload: EventPayload = { step, header: data.header, notify: tracker.notifyTelegram };
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
            (code === "not_found" || code === "mismatch"
              ? TRACKER_CONFIG.checkIntervalHours * HOUR_MS
              : TRACKER_CONFIG.retryAfterMinutes * 60_000),
        ),
      },
    });
  }

  async function checkTramite(tracker: Tracker): Promise<void> {
    try {
      let part;
      if (isDnmKind(tracker.kind)) {
        const birthDate = await dnmBirthDate(tracker);
        if (!birthDate) throw new ScraperError("birth_date_missing");
        part = await scraper.dnm({ kind: tracker.kind, number: tracker.reference, birthDate });
      } else {
        part =
          tracker.kind === "RENAPER"
            ? await scraper.renaper(tracker.reference)
            : await scraper.correo(tracker.reference);
      }
      await applyResult(tracker, { header: part.header, steps: part.steps, finished: part.finished });
    } catch (error) {
      await recordFailure(tracker, error);
    }
  }

  async function checkPjn(tracker: Tracker, options: { announceFinish?: boolean } = {}): Promise<void> {
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
      }, options);
    } catch (error) {
      await recordFailure(tracker, error);
    }
  }

  /**
   * Closes active cases whose stored data already shows a final status. The list of final
   * statuses is configuration, so a status added to it applies to existing cases at once,
   * without waiting for their next check. Quiet: nobody is notified about it.
   */
  async function closeFinished(): Promise<number> {
    const rows = await prisma.tracker.findMany({
      where: { status: "ACTIVE", snapshot: { isNot: null } },
      include: { snapshot: true },
      take: 500,
    });
    const ids = rows
      .filter((row) =>
        reachedFinalStatus(row.kind as TrackerKindValue, {
          header: (row.snapshot?.header ?? {}) as TrackerHeaderFields,
          steps: (row.snapshot?.steps ?? []) as unknown as TrackerStep[],
        }),
      )
      .map((row) => row.id);
    if (ids.length === 0) return 0;
    const result = await prisma.tracker.updateMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      data: { status: "FINISHED", notifyTelegram: false, notifyWhatsapp: false, finishedAt: now() },
    });
    return result.count;
  }

  /** Checks trackers whose time has come (called by the worker on a timer). */
  async function runDue(limit: number = TRACKER_CONFIG.batchSize): Promise<number> {
    await closeFinished();
    await grants.sweepExpired();
    const ids = await capacity.coveredDueIds(limit);
    const due = await prisma.tracker.findMany({
      where: { id: { in: ids } },
      orderBy: { nextCheckAt: "asc" },
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
        tracker: { include: { user: true } },
      },
    });
    const order = SERVICE_GROUPS.flatMap((group) => group.items.map((item) => item.section as string));
    const entries: {
      item: PendingNotification;
      section: number;
      createdAt: number;
    }[] = [];
    for (const event of events) {
      const { tracker } = event;
      const { user } = tracker;
      const section = TRACKER_KIND_SECTION[tracker.kind as TrackerKindValue];
      const payload = event.payload as unknown as EventPayload;
      if (user.telegramId === null || !(payload.notify ?? tracker.notifyTelegram)) {
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
        section: order.indexOf(section),
        createdAt: event.createdAt.getTime(),
        item: {
        eventId: event.id,
        telegramId: user.telegramId,
        locale: user.locale,
        kind: tracker.kind as TrackerKindValue,
        who: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
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
    // By menu order; updates of one case keep their time order.
    entries.sort((a, b) => a.section - b.section || a.createdAt - b.createdAt);
    return entries.map((entry) => entry.item);
  }

  /**
   * Latest stage of every case, in the order of the left menu (DNI first, then
   * citizenship). Sent once when Telegram is linked.
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
        status: { notIn: ["PENDING_CONFIRMATION", "PAUSED"] },
        // cases switched off for Telegram are left out of the digest
        notifyTelegram: true,
      },
      include: { snapshot: true },
    });
    const order = SERVICE_GROUPS.flatMap((group) => group.items.map((item) => item.section as string));
    const sorted = rows
      .map((row) => {
        const kind = row.kind as TrackerKindValue;
        const steps = (row.snapshot?.steps ?? []) as unknown as TrackerStep[];
        const item: DigestItem = {
          kind,
          section: TRACKER_KIND_SECTION[kind] as string,
          who: ownerName,
          caseId: caseIdentifier(
            kind,
            row.reference,
            (row.snapshot?.header ?? {}) as TrackerHeaderFields,
          ),
          header: (row.snapshot?.header ?? {}) as TrackerHeaderFields,
          step: steps.length ? steps[steps.length - 1]! : null,
        };
        return item;
      })
      // menu order
      .sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
    return sorted;
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
    previewTramite,
    closeFinished,
    statusStats,
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
