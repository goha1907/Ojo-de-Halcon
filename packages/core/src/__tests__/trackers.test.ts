import { TRACKER_CONFIG } from "@ojo/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { PjnCaseResult, ScrapedTramite } from "../index";
import { ScraperError } from "../index";
import { adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

const HOUR = 3_600_000;

function renaperAnswer(overrides: Partial<ScrapedTramite> = {}): ScrapedTramite {
  return {
    found: true,
    header: { status: "Verificado" },
    steps: [{ date: "2026-10-11", title: "Verificado", detail: "" }],
    finished: false,
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

async function subscribe(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionUntil: new Date(Date.now() + 30 * 86_400_000), seats: 5 },
  });
}

describe("trackers: trámite", () => {
  it("adds RENAPER and Correo independently", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await subscribe(userId);
    const renaper = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    expect(renaper).toMatchObject({ ok: true });
    expect((await core.trackers.list(userId)).map((item) => item.kind)).toEqual(["RENAPER"]);

    // the same number may also be followed at the post office, as its own tracker
    expect(await core.trackers.addTramite(userId, "CORREO", "755824304")).toMatchObject({ ok: true });
    expect((await core.trackers.list(userId)).map((item) => item.kind).sort()).toEqual(["CORREO", "RENAPER"]);
  });

  it("rejects the same number twice and a second number in the same section", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await subscribe(userId);
    await core.trackers.addTramite(userId, "CORREO", "755824304");
    expect(await core.trackers.addTramite(userId, "CORREO", "755824304")).toMatchObject({
      ok: false,
      reason: "ALREADY_EXISTS",
    });
    expect(await core.trackers.addTramite(userId, "CORREO", "111111111")).toMatchObject({
      ok: false,
      reason: "SECTION_BUSY",
    });
  });

  it("covers a single tracker in the trial", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    expect(await core.trackers.addTramite(userId, "RENAPER", "755824304")).toMatchObject({ ok: true });
    expect(await core.trackers.addTramite(userId, "CORREO", "755824304")).toMatchObject({
      ok: false,
      reason: "SUBSCRIPTION_REQUIRED",
    });
  });

  it("queries only its own source and notifies only on change", async () => {
    let renaperCalls = 0;
    let correoCalls = 0;
    let answer = renaperAnswer();
    let clock = new Date("2026-10-14T10:00:00Z");
    const core = makeCore({
      now: () => clock,
      scraper: {
        renaper: async () => {
          renaperCalls += 1;
          return answer;
        },
        correo: async () => {
          correoCalls += 1;
          return renaperAnswer({ steps: [] });
        },
      },
    });
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");

    expect(await core.trackers.runDue()).toBe(1);
    expect([renaperCalls, correoCalls]).toEqual([1, 0]);
    // the first read produces the single "case added" report
    const first = await prisma.trackerEvent.findMany();
    expect(first).toHaveLength(1);
    expect((first[0]!.payload as { initial?: boolean }).initial).toBe(true);
    expect(await core.trackers.runDue()).toBe(0); // not due yet

    clock = new Date(clock.getTime() + (TRACKER_CONFIG.checkIntervalHours + 1) * HOUR);
    answer = renaperAnswer({
      steps: [
        { date: "2026-10-11", title: "Verificado", detail: "" },
        { date: "2026-10-14", title: "En producción", detail: "" },
      ],
    });
    await core.trackers.runDue();
    expect(await prisma.trackerEvent.count()).toBe(2); // + the "En producción" change
  });

  it("checks the regular cadence when the number is not found yet", async () => {
    const clock = new Date("2026-10-14T10:00:00Z");
    const core = makeCore({
      now: () => clock,
      scraper: {
        correo: async () => {
          throw new ScraperError("not_found");
        },
      },
    });
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "CORREO", "755824304");
    await core.trackers.runDue();
    const [tracker] = await core.trackers.list(userId);
    expect(tracker!.lastError).toBe("not_found");
    const row = await prisma.tracker.findFirstOrThrow();
    expect(row.nextCheckAt.getTime() - clock.getTime()).toBe(TRACKER_CONFIG.checkIntervalHours * HOUR);
  });

  it("retries sooner after a source failure", async () => {
    const clock = new Date("2026-10-14T10:00:00Z");
    const core = makeCore({
      now: () => clock,
      scraper: {
        renaper: async () => {
          throw new ScraperError("failed");
        },
      },
    });
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await core.trackers.runDue();
    const row = await prisma.tracker.findFirstOrThrow();
    expect(row.lastError).toBe("failed");
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
    const queries: string[] = [];
    const core = makeCore({
      scraper: {
        pjnParty: async ({ name }) => {
          queries.push(name);
          return [
          { expediente: "CNE 007900/2026", dependencia: "J", caratula: "MEDVEDEV, EGOR S/NAC", situacion: "", ultima_actuacion: "" },
          { expediente: "CNE 001000/2025", dependencia: "J", caratula: "MEDVEDEV, IVAN S/NAC", situacion: "", ultima_actuacion: "" },
          ];
        },
      },
    });
    const userId = await newUser(core);
    const result = await core.trackers.findPjnByProfile(userId);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.candidates.map((item) => item.number)).toEqual(["7900"]);
    // the site is queried as "SURNAME NAME"
    expect(queries).toEqual(["Medvedev Egor"]);
  });

  it("does not offer a case that is already tracked", async () => {
    const core = makeCore({
      scraper: {
        pjnParty: async () => [
          { expediente: "CNE 007900/2026", dependencia: "J", caratula: "MEDVEDEV, EGOR S/NAC", situacion: "", ultima_actuacion: "" },
        ],
        pjnCase: async () => ({ header: caseResult.header }),
      },
    });
    const userId = await newUser(core);
    await core.trackers.startPjn(userId, { jurisdiction: "4", number: "7900", year: "2026" });
    const result = await core.trackers.findPjnByProfile(userId);
    expect(result).toEqual({ ok: true, candidates: [] });
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

  it("lets users discard only an unconfirmed case", async () => {
    const core = makeCore({
      scraper: { pjnCase: async (input) => (input.headerOnly ? { header: caseResult.header } : caseResult) },
    });
    const userId = await newUser(core);
    const started = await core.trackers.startPjn(userId, { jurisdiction: "4", number: "7900", year: "2026" });
    if (!started.ok) throw new Error("start failed");
    await core.trackers.confirmPjn(userId, started.tracker.id);
    // confirmed: users cannot remove it themselves
    expect(await core.trackers.discardPending(userId, started.tracker.id)).toBe(false);
    expect(await core.trackers.list(userId)).toHaveLength(1);

    const again = await core.trackers.startPjn(userId, { jurisdiction: "4", number: "7901", year: "2026" });
    expect(again).toMatchObject({ ok: false, reason: "SECTION_BUSY" });
  });

  it("discards a case that is still waiting for confirmation", async () => {
    const core = makeCore({ scraper: { pjnCase: async () => ({ header: caseResult.header }) } });
    const userId = await newUser(core);
    const started = await core.trackers.startPjn(userId, { jurisdiction: "4", number: "7900", year: "2026" });
    if (!started.ok) throw new Error("start failed");
    expect(await core.trackers.discardPending(userId, started.tracker.id)).toBe(true);
    expect(await core.trackers.list(userId)).toHaveLength(0);
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
      data: { trackerId: added.tracker.id, payload: { step: null, header: {} } },
    });
    expect(await core.trackers.pendingNotifications()).toHaveLength(0);
    expect(await prisma.trackerEvent.count({ where: { notifiedAt: null } })).toBe(0);

    await prisma.user.update({ where: { id: userId }, data: { telegramId: 42n } });
    await prisma.trackerEvent.create({
      data: { trackerId: added.tracker.id, payload: { step: null, header: {} } },
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

  it("requires a subscription for relatives, then tracks them separately", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    expect(await core.people.add(userId, person)).toEqual({ ok: false, reason: "SUBSCRIPTION_REQUIRED" });
    await subscribe(userId);
    const added = await core.people.add(userId, person);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    // a child is allowed (no 18+ rule for relatives)
    expect(added.person.birthDate).toBe("2015-05-01");

    const own = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    expect(own.ok).toBe(true);
    // with a subscription the relative's case is allowed next to the owner's
    expect(await core.trackers.addTramite(userId, "RENAPER", "111111111", added.person.id)).toMatchObject({
      ok: true,
    });
    // without it the trial covers one case only
    const second = await core.people.add(userId, { ...person, firstName: "Luis" });
    if (!second.ok) throw new Error("second person failed");
    await prisma.user.update({ where: { id: userId }, data: { subscriptionUntil: null } });
    expect(await core.trackers.addTramite(userId, "RENAPER", "999999999", second.person.id)).toMatchObject({
      ok: false,
      reason: "SUBSCRIPTION_REQUIRED",
    });
  });

  it("blocks people during the trial, until a subscription exists", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    expect(await core.people.add(userId, person)).toEqual({ ok: false, reason: "SUBSCRIPTION_REQUIRED" });

    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionUntil: new Date(Date.now() + 30 * 86_400_000), seats: 5 },
    });
    expect(await core.people.add(userId, person)).toMatchObject({ ok: true });
  });

  it("caps relatives at five", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await subscribe(userId);
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
      data: { subscriptionUntil: new Date(Date.now() + 30 * 86_400_000), seats: 5 },
    });
    const added = await core.people.add(userId, person);
    if (!added.ok) throw new Error("person failed");
    expect(await core.trackers.addTramite(userId, "RENAPER", "755824304")).toMatchObject({ ok: true });
    expect(await core.trackers.addTramite(userId, "RENAPER", "755824304", added.person.id)).toMatchObject({
      ok: true,
    });
    const list = await core.trackers.list(userId);
    expect(list.filter((item) => item.person?.id === added.person.id)).toHaveLength(1);
    expect(list).toHaveLength(2);
  });

  it("does not touch other users' people and removes cases with the person", async () => {
    const core = makeCore();
    const owner = await newUser(core);
    const other = await newUser(core, "other@example.com");
    await prisma.user.update({
      where: { id: owner },
      data: { subscriptionUntil: new Date(Date.now() + 30 * 86_400_000), seats: 5 },
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

describe("trial is tied to the user, not to the case", () => {
  it("lets another account track the same case with its own trial", async () => {
    const core = makeCore();
    const first = await newUser(core, "first@example.com");
    const second = await newUser(core, "second@example.com");
    expect(await core.trackers.addTramite(first, "RENAPER", "755824304")).toMatchObject({ ok: true });
    expect(await core.trackers.addTramite(second, "RENAPER", "755824304")).toMatchObject({ ok: true });
  });
});

describe("notification claims", () => {
  it("gives each event to one worker", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await prisma.user.update({ where: { id: userId }, data: { telegramId: 11n } });
    const added = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!added.ok) throw new Error("add failed");
    await prisma.trackerEvent.create({
      data: { trackerId: added.tracker.id, payload: { step: null, header: {} } },
    });
    const [a, b] = await Promise.all([core.trackers.pendingNotifications(), core.trackers.pendingNotifications()]);
    expect(a.length + b.length).toBe(1);
  });
});

describe("ordered notifications and the Telegram digest", () => {
  const step = (n: number) => ({ date: `${n}/10/2026`, title: `STEP ${n}`, detail: "" });
  const pjn = (count: number): PjnCaseResult => ({
    header: { expediente: "CNE 007900/2026", dependencia: "J", sit_actual: "GIRO", caratula: "MEDVEDEV, EGOR S/NAC" },
    actuaciones: Array.from({ length: count }, (_, i) => ({
      orden: i + 1,
      fecha: `${i + 1}/10/2026`,
      oficina: "",
      tipo: `STEP ${i + 1}`,
      detalle: "",
    })),
  });

  async function confirmedCase(core: ReturnType<typeof makeCore>, userId: string) {
    const started = await core.trackers.startPjn(userId, { jurisdiction: "4", number: "7900", year: "2026" });
    if (!started.ok) throw new Error("start failed");
    await core.trackers.confirmPjn(userId, started.tracker.id);
  }

  it("creates one event per new stage, oldest first, and no events for the first full read", async () => {
    let clock = new Date("2026-10-14T10:00:00Z");
    let size = 3;
    const core = makeCore({
      now: () => clock,
      scraper: { pjnCase: async (input) => (input.headerOnly ? { header: pjn(0).header } : pjn(size)) },
    });
    const userId = await newUser(core);
    await confirmedCase(core, userId);

    await core.trackers.runDue(); // first full parse: one "case added" report, no per-stage events
    const initial = await prisma.trackerEvent.findMany();
    expect(initial).toHaveLength(1);
    expect((initial[0]!.payload as { initial?: boolean }).initial).toBe(true);

    clock = new Date(clock.getTime() + 4 * HOUR);
    size = 6; // three stages appeared between two checks
    await core.trackers.runDue();
    const events = (await prisma.trackerEvent.findMany({ orderBy: { createdAt: "asc" } })).slice(1);
    expect(events.map((event) => (event.payload as { step: { title: string } }).step.title)).toEqual([
      "STEP 4",
      "STEP 5",
      "STEP 6",
    ]);
  });

  it("delivers pending events in the order they happened", async () => {
    let clock = new Date("2026-10-14T10:00:00Z");
    let size = 1;
    const core = makeCore({
      now: () => clock,
      scraper: { pjnCase: async (input) => (input.headerOnly ? { header: pjn(0).header } : pjn(size)) },
    });
    const userId = await newUser(core);
    await prisma.user.update({ where: { id: userId }, data: { telegramId: 99n } });
    await confirmedCase(core, userId);
    await core.trackers.runDue();
    clock = new Date(clock.getTime() + 4 * HOUR);
    size = 3;
    await core.trackers.runDue();

    const pending = await core.trackers.pendingNotifications();
    // the "case added" report (latest stage then), followed by the new stages in order
    expect(pending.map((item) => item.payload.step?.title)).toEqual(["STEP 1", "STEP 2", "STEP 3"]);
  });

  it("builds the digest in menu order with the latest stage of each case", async () => {
    const core = makeCore({
      scraper: {
        renaper: async () => renaperAnswer(),
        correo: async () => renaperAnswer({ header: {}, steps: [step(1), step(2)] }),
        pjnCase: async (input) => (input.headerOnly ? { header: pjn(0).header } : pjn(4)),
      },
    });
    const userId = await newUser(core);
    await subscribe(userId);
    await confirmedCase(core, userId); // court first (the last menu item)
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await core.trackers.addTramite(userId, "CORREO", "755824304");
    await core.trackers.runDue();

    const digest = await core.trackers.latestSteps(userId);
    expect(digest.map((item) => [item.section, item.step?.title])).toEqual([
      ["dni_production", "Verificado"],
      ["dni_post", "STEP 2"],
      ["citizenship_court", "STEP 4"],
    ]);
  });
});

describe("muted relatives", () => {
  it("keeps a muted person's updates and digest out of Telegram", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await subscribe(userId);
    await prisma.user.update({ where: { id: userId }, data: { telegramId: 55n } });
    const added = await core.people.add(userId, {
      firstName: "Ana",
      lastName: "Perez",
      birthDate: new Date("2015-05-01T00:00:00Z"),
      pjnJurisdiction: "",
      notifyTelegram: false,
    });
    if (!added.ok) throw new Error("person failed");
    const tracked = await core.trackers.addTramite(userId, "RENAPER", "755824304", added.person.id);
    if (!tracked.ok) throw new Error("add failed");
    await prisma.trackerSnapshot.create({
      data: {
        trackerId: tracked.tracker.id,
        header: {},
        steps: [{ date: "1/10/2026", title: "X", detail: "" }],
        contentHash: "h",
      },
    });
    await prisma.trackerEvent.create({
      data: { trackerId: tracked.tracker.id, payload: { step: null, header: {} } },
    });

    expect(await core.trackers.pendingNotifications()).toHaveLength(0);
    expect(await core.trackers.latestSteps(userId)).toHaveLength(0);

    // turned back on: the digest includes the person again
    await core.people.setNotify(userId, added.person.id, true);
    expect(await core.trackers.latestSteps(userId)).toHaveLength(1);
  });
});

describe("case added and relative notices", () => {
  const draft = (notifyTelegram: boolean) => ({
    firstName: "Ana",
    lastName: "Perez",
    birthDate: new Date("2015-05-01T00:00:00Z"),
    pjnJurisdiction: "",
    notifyTelegram,
  });

  async function withTelegram(core: ReturnType<typeof makeCore>) {
    const userId = await newUser(core);
    await subscribe(userId);
    await prisma.user.update({ where: { id: userId }, data: { telegramId: 31n } });
    return userId;
  }

  it("queues a message when a relative is added and when one is removed", async () => {
    const core = makeCore();
    const userId = await withTelegram(core);
    const added = await core.people.add(userId, draft(true));
    if (!added.ok) throw new Error("add failed");
    expect(await core.people.remove(userId, added.person.id)).toBe(true);

    const rows = await prisma.telegramOutbox.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows.map((row) => [row.kind, row.payload])).toEqual([
      ["person_added", { name: "Ana Perez" }],
      ["person_removed", { name: "Ana Perez" }],
    ]);
  });

  it("announces relatives removed together with slots", async () => {
    const core = makeCore();
    const userId = await withTelegram(core);
    const added = await core.people.add(userId, draft(true));
    if (!added.ok) throw new Error("add failed");
    await prisma.telegramOutbox.deleteMany();
    // 5 seats, 1 person: dropping to 0 seats requires removing her
    await core.billing.reduceSeats(userId, { seats: 0, removePersonIds: [added.person.id] });
    const kinds = (await prisma.telegramOutbox.findMany()).map((row) => row.kind);
    expect(kinds).toEqual(["person_removed"]);
  });

  it("reports a new case at once when the person is not muted", async () => {
    const core = makeCore({ scraper: { renaper: async () => renaperAnswer() } });
    const userId = await withTelegram(core);
    const added = await core.people.add(userId, draft(true));
    if (!added.ok) throw new Error("add failed");
    await core.trackers.addTramite(userId, "RENAPER", "755824304", added.person.id);
    await core.trackers.runDue();
    const pending = await core.trackers.pendingNotifications();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.payload.initial).toBe(true);
    expect(pending[0]!.label).toBe("Ana Perez");
  });

  it("holds the report while the person is muted and sends it at the next refresh after unmuting", async () => {
    let clock = new Date("2026-10-14T10:00:00Z");
    const core = makeCore({ now: () => clock, scraper: { renaper: async () => renaperAnswer() } });
    const userId = await withTelegram(core);
    const added = await core.people.add(userId, draft(false));
    if (!added.ok) throw new Error("add failed");
    await core.trackers.addTramite(userId, "RENAPER", "755824304", added.person.id);

    await core.trackers.runDue();
    expect(await prisma.trackerEvent.count()).toBe(0); // silent while muted
    expect((await prisma.tracker.findFirstOrThrow()).initialNotified).toBe(false);

    await core.people.setNotify(userId, added.person.id, true);
    expect(await prisma.trackerEvent.count()).toBe(0); // nothing is sent by toggling alone

    clock = new Date(clock.getTime() + (TRACKER_CONFIG.checkIntervalHours + 1) * HOUR);
    await core.trackers.runDue();
    const events = await prisma.trackerEvent.findMany();
    expect(events).toHaveLength(1);
    expect((events[0]!.payload as { initial?: boolean }).initial).toBe(true);
  });
});
