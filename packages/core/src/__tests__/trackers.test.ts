import { TRACKER_CONFIG } from "@ojo/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { PjnCaseResult, TramiteResult } from "../index";
import { ScraperError } from "../index";
import { adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

const HOUR = 3_600_000;

function tramite(overrides: Partial<TramiteResult> = {}): TramiteResult {
  return {
    renaper: {
      found: true,
      header: { status: "Verificado" },
      steps: [{ date: "2026-10-11", title: "Verificado", detail: "" }],
      finished: false,
    },
    correo: { found: false, header: {}, steps: [], finished: false },
    ...overrides,
  };
}

async function newUser(core: ReturnType<typeof makeCore>, email = "a@example.com") {
  const result = await core.accounts.register({ email, password: "password-123" });
  if (!result.ok) throw new Error("register failed");
  await core.profile.update(result.userId, adultProfile);
  return result.userId;
}

beforeEach(resetDb);

describe("trackers: trámite", () => {
  it("creates RENAPER and Correo together and reports the twin", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    const result = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    expect(result).toMatchObject({ ok: true, alsoCreated: "CORREO" });
    const kinds = (await core.trackers.list(userId)).map((item) => item.kind).sort();
    expect(kinds).toEqual(["CORREO", "RENAPER"]);
  });

  it("rejects the same number twice and a second number in the same section", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "CORREO", "755824304");
    expect(await core.trackers.addTramite(userId, "RENAPER", "755824304")).toMatchObject({
      ok: false,
      reason: "ALREADY_EXISTS",
    });
    expect(await core.trackers.addTramite(userId, "RENAPER", "111111111")).toMatchObject({
      ok: false,
      reason: "SECTION_BUSY",
    });
  });

  it("removes the pair together", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    const added = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!added.ok) throw new Error("add failed");
    expect(await core.trackers.remove(userId, added.tracker.id)).toBe(true);
    expect(await core.trackers.list(userId)).toHaveLength(0);
  });

  it("splits one scrape between both tabs and notifies only on change", async () => {
    let calls = 0;
    let answer = tramite();
    let clock = new Date("2026-10-14T10:00:00Z");
    const core = makeCore({
      now: () => clock,
      scraper: {
        tramite: async () => {
          calls += 1;
          return answer;
        },
      },
    });
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");

    expect(await core.trackers.runDue()).toBe(1);
    expect(calls).toBe(1);
    const first = await core.trackers.list(userId);
    expect(first.find((item) => item.kind === "RENAPER")!.steps).toHaveLength(1);
    expect(first.find((item) => item.kind === "CORREO")!.steps).toHaveLength(0);
    expect(await prisma.trackerEvent.count()).toBe(0);

    // not due yet
    expect(await core.trackers.runDue()).toBe(0);

    clock = new Date(clock.getTime() + (TRACKER_CONFIG.checkIntervalHours + 1) * HOUR);
    answer = tramite({
      correo: {
        found: true,
        header: {},
        steps: [{ date: "2026-10-14", title: "En camino", detail: "Paraná" }],
        finished: false,
      },
    });
    await core.trackers.runDue();
    const events = await prisma.trackerEvent.findMany({ include: { tracker: true } });
    expect(events).toHaveLength(1);
    expect(events[0]!.tracker.kind).toBe("CORREO");
  });

  it("schedules a retry after a source failure", async () => {
    const clock = new Date("2026-10-14T10:00:00Z");
    const core = makeCore({
      now: () => clock,
      scraper: {
        tramite: async () => {
          throw new ScraperError("not_found");
        },
      },
    });
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await core.trackers.runDue();
    const [tracker] = await core.trackers.list(userId);
    expect(tracker!.lastError).toBe("not_found");
    const row = await prisma.tracker.findFirstOrThrow();
    expect(row.nextCheckAt.getTime() - clock.getTime()).toBe(TRACKER_CONFIG.retryAfterMinutes * 60_000);
  });
});

describe("trackers: PJN", () => {
  const caseResult: PjnCaseResult = {
    header: {
      expediente: "CNE 007900/2026",
      dependencia: "JUZGADO",
      sit_actual: "GIRO",
      caratula: "MEDVEDEV, EGOR S/NACIONALIDAD",
    },
    actuaciones: [{ orden: 1, fecha: "1/09/2026", oficina: "X", tipo: "ESCRITO", detalle: "PRESENTACION" }],
  };

  it("finds candidates by profile name and ignores other people", async () => {
    const core = makeCore({
      scraper: {
        pjnParty: async () => [
          { expediente: "CNE 007900/2026", dependencia: "J", caratula: "MEDVEDEV, EGOR S/NAC", situacion: "", ultima_actuacion: "" },
          { expediente: "CNE 001000/2025", dependencia: "J", caratula: "MEDVEDEV, IVAN S/NAC", situacion: "", ultima_actuacion: "" },
        ],
      },
    });
    const userId = await newUser(core);
    const result = await core.trackers.findPjnByProfile(userId);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.candidates.map((item) => item.number)).toEqual(["7900"]);
  });

  it("needs a court and a full name before searching", async () => {
    const core = makeCore();
    const registered = await core.accounts.register({ email: "b@example.com", password: "password-123" });
    if (!registered.ok) throw new Error("register failed");
    expect(await core.trackers.findPjnByProfile(registered.userId)).toEqual({
      ok: false,
      reason: "PROFILE_INCOMPLETE",
    });
  });

  it("parses only the header until the user confirms, then fully", async () => {
    const calls: boolean[] = [];
    const core = makeCore({
      scraper: {
        pjnCase: async (input) => {
          calls.push(Boolean(input.headerOnly));
          return input.headerOnly ? { header: caseResult.header } : caseResult;
        },
      },
    });
    const userId = await newUser(core);
    const started = await core.trackers.startPjn(userId, { jurisdiction: "4", number: "7900", year: "2026" });
    expect(started).toMatchObject({ ok: true });
    expect(calls).toEqual([true]);

    // pending trackers are never checked
    expect(await core.trackers.runDue()).toBe(0);

    if (!started.ok) return;
    expect(await core.trackers.confirmPjn(userId, started.tracker.id)).toBe(true);
    expect(await core.trackers.runDue()).toBe(1);
    expect(calls).toEqual([true, false]);
    const [tracker] = await core.trackers.list(userId);
    expect(tracker!.steps).toHaveLength(1);
    expect(tracker!.header.sit_actual).toBe("GIRO");
  });

  it("reports a case that does not exist", async () => {
    const core = makeCore({
      scraper: {
        pjnCase: async () => {
          throw new ScraperError("not_found");
        },
      },
    });
    const userId = await newUser(core);
    expect(await core.trackers.startPjn(userId, { jurisdiction: "4", number: "99999", year: "2026" })).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
  });
});

describe("trackers: notifications", () => {
  it("skips users without Telegram and respects the service switch", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    const added = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!added.ok) throw new Error("add failed");
    await prisma.trackerEvent.create({
      data: { trackerId: added.tracker.id, payload: { newSteps: [], header: {} } },
    });
    expect(await core.trackers.pendingNotifications()).toHaveLength(0);
    expect(await prisma.trackerEvent.count({ where: { notifiedAt: null } })).toBe(0);

    await prisma.user.update({ where: { id: userId }, data: { telegramId: 42n } });
    await prisma.trackerEvent.create({
      data: { trackerId: added.tracker.id, payload: { newSteps: [], header: {} } },
    });
    const pending = await core.trackers.pendingNotifications();
    expect(pending).toHaveLength(1);
    await core.trackers.markNotified(pending[0]!.eventId);
    expect(await core.trackers.pendingNotifications()).toHaveLength(0);
  });
});

describe("people and trial", () => {
  const person = {
    firstName: "Ana",
    lastName: "Medvedeva",
    birthDate: new Date("2015-05-01T00:00:00Z"),
    pjnJurisdiction: "4",
  };

  it("lets the owner add relatives before the trial and tracks them separately", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    const added = await core.people.add(userId, person);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    // a child is allowed (no 18+ rule for relatives)
    expect(added.person.birthDate).toBe("2015-05-01");

    const own = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    expect(own.ok).toBe(true);
    // second case needs a subscription (trial covers one case)
    expect(await core.trackers.addTramite(userId, "RENAPER", "111111111", added.person.id)).toMatchObject({
      ok: false,
      reason: "SUBSCRIPTION_REQUIRED",
    });
  });

  it("allows the twin of the trial case but not a different one", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await prisma.tracker.deleteMany({ where: { userId, kind: "CORREO" } });
    expect(await core.trackers.addTramite(userId, "CORREO", "755824304")).toMatchObject({ ok: true });
  });

  it("blocks more people once the trial started, until a subscription exists", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    expect(await core.people.add(userId, person)).toEqual({ ok: false, reason: "SUBSCRIPTION_REQUIRED" });

    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionUntil: new Date(Date.now() + 30 * 86_400_000) },
    });
    expect(await core.people.add(userId, person)).toMatchObject({ ok: true });
  });

  it("caps relatives at five", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    for (let i = 0; i < 5; i += 1) {
      expect(await core.people.add(userId, { ...person, firstName: `P${i}` })).toMatchObject({ ok: true });
    }
    expect(await core.people.add(userId, person)).toEqual({ ok: false, reason: "LIMIT_REACHED" });
  });

  it("keeps one case per section separately for each person", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionUntil: new Date(Date.now() + 30 * 86_400_000) },
    });
    const added = await core.people.add(userId, person);
    if (!added.ok) throw new Error("person failed");
    expect(await core.trackers.addTramite(userId, "RENAPER", "755824304")).toMatchObject({ ok: true });
    expect(await core.trackers.addTramite(userId, "RENAPER", "755824304", added.person.id)).toMatchObject({
      ok: true,
    });
    const list = await core.trackers.list(userId);
    expect(list.filter((item) => item.person?.id === added.person.id)).toHaveLength(2);
  });

  it("does not touch other users' people and removes cases with the person", async () => {
    const core = makeCore();
    const owner = await newUser(core);
    const other = await newUser(core, "other@example.com");
    await prisma.user.update({
      where: { id: owner },
      data: { subscriptionUntil: new Date(Date.now() + 30 * 86_400_000) },
    });
    const added = await core.people.add(owner, person);
    if (!added.ok) throw new Error("person failed");
    expect(await core.trackers.addTramite(other, "RENAPER", "1234567", added.person.id)).toMatchObject({
      ok: false,
      reason: "PERSON_NOT_FOUND",
    });
    await core.trackers.addTramite(owner, "RENAPER", "755824304", added.person.id);
    expect(await core.people.remove(other, added.person.id)).toBe(false);
    expect(await core.people.remove(owner, added.person.id)).toBe(true);
    expect(await prisma.tracker.count({ where: { userId: owner } })).toBe(0);
  });

  it("pauses checks when the trial is over", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await prisma.user.update({
      where: { id: userId },
      data: { trialStartedAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    expect(await core.trackers.runDue()).toBe(0);
  });
});
