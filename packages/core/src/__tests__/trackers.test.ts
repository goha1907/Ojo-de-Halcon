import { TRACKER_CONFIG, casesPrice } from "@ojo/shared";
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
    data: { subscriptionUntil: new Date(Date.now() + 30 * 86_400_000), paidCases: 5 },
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

  it("rejects the same number twice and a case beyond the paid ones", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await core.billing.checkout(userId, 1); // subscribed, one case paid
    await core.trackers.addTramite(userId, "CORREO", "755824304");
    expect(await core.trackers.addTramite(userId, "CORREO", "755824304")).toMatchObject({
      ok: false,
      reason: "ALREADY_EXISTS",
    });
    expect(await core.trackers.addTramite(userId, "CORREO", "111111111")).toMatchObject({
      ok: false,
      reason: "NO_FREE_SLOT",
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

  it("does not report fields the scraper only started to read", async () => {
    let answer = renaperAnswer();
    let clock = new Date("2026-10-14T10:00:00Z");
    const core = makeCore({ now: () => clock, scraper: { renaper: async () => answer } });
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await core.trackers.runDue();
    expect(await prisma.trackerEvent.count()).toBe(1);

    clock = new Date(clock.getTime() + (TRACKER_CONFIG.checkIntervalHours + 1) * HOUR);
    answer = renaperAnswer({ header: { status: "Verificado", office: "RC CD ER PARANA 4" } });
    await core.trackers.runDue();
    expect(await prisma.trackerEvent.count()).toBe(1); // new field: stored, not news
    const [tracker] = await core.trackers.list(userId);
    expect(tracker!.header.office).toBe("RC CD ER PARANA 4");

    clock = new Date(clock.getTime() + (TRACKER_CONFIG.checkIntervalHours + 1) * HOUR);
    answer = renaperAnswer({ header: { status: "Impreso", office: "RC CD ER PARANA 4" } });
    await core.trackers.runDue();
    expect(await prisma.trackerEvent.count()).toBe(2); // a known field changed
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
    expect(again).toMatchObject({ ok: false, reason: "SUBSCRIPTION_REQUIRED" });
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

describe("trial", () => {
  it("covers one case, a subscription as many as were paid for", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    expect(await core.trackers.addTramite(userId, "CORREO", "755824304")).toMatchObject({
      ok: false,
      reason: "SUBSCRIPTION_REQUIRED",
    });
    await subscribe(userId);
    expect(await core.trackers.addTramite(userId, "CORREO", "755824304")).toMatchObject({ ok: true });
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
    await confirmedCase(core, userId); // court first (before the post office in the menu)
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await core.trackers.addTramite(userId, "CORREO", "755824304");
    await core.trackers.runDue();

    const digest = await core.trackers.latestSteps(userId);
    expect(digest.map((item) => [item.section, item.step?.title])).toEqual([
      ["dni_production", "Verificado"],
      ["citizenship_court", "STEP 4"],
      ["dni_post", "STEP 2"],
    ]);
  });
});

describe("case added notices", () => {
  async function withTelegram(core: ReturnType<typeof makeCore>) {
    const userId = await newUser(core);
    await subscribe(userId);
    await prisma.user.update({ where: { id: userId }, data: { telegramId: 31n } });
    return userId;
  }

  it("reports a new case at once", async () => {
    const core = makeCore({ scraper: { renaper: async () => renaperAnswer() } });
    const userId = await withTelegram(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await core.trackers.runDue();
    const pending = await core.trackers.pendingNotifications();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.payload.initial).toBe(true);
    expect(pending[0]!.who).toBe("Egor Medvedev");
  });

  it("holds the report while Telegram is off for the case and sends it at the next refresh after switching on", async () => {
    let clock = new Date("2026-10-14T10:00:00Z");
    const core = makeCore({ now: () => clock, scraper: { renaper: async () => renaperAnswer() } });
    const userId = await withTelegram(core);
    const added = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!added.ok) throw new Error("add failed");
    await core.trackers.setNotify(userId, added.tracker.id, false);

    await core.trackers.runDue();
    expect(await prisma.trackerEvent.count()).toBe(0); // silent while off
    expect((await prisma.tracker.findFirstOrThrow()).initialNotified).toBe(false);

    await core.trackers.setNotify(userId, added.tracker.id, true);
    expect(await prisma.trackerEvent.count()).toBe(0); // nothing is sent by toggling alone

    clock = new Date(clock.getTime() + (TRACKER_CONFIG.checkIntervalHours + 1) * HOUR);
    await core.trackers.runDue();
    const events = await prisma.trackerEvent.findMany();
    expect(events).toHaveLength(1);
    expect((events[0]!.payload as { initial?: boolean }).initial).toBe(true);
  });
});

describe("digest respects the per-case switches", () => {
  it("leaves out cases switched off for Telegram", async () => {
    const core = makeCore({ scraper: { renaper: async () => renaperAnswer() } });
    const userId = await newUser(core);
    await subscribe(userId);
    const added = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!added.ok) throw new Error("add failed");
    await core.trackers.runDue();
    expect(await core.trackers.latestSteps(userId)).toHaveLength(1);

    expect(await core.trackers.setNotify(userId, added.tracker.id, false)).toBe(true);
    expect(await core.trackers.latestSteps(userId)).toHaveLength(0);
  });
});

describe("Migraciones trackers", () => {
  const answer: ScrapedTramite = {
    found: true,
    header: { status: "PRECARIA RENOVADA", statusDate: "2026-03-16", office: "ENTRE RIOS" },
    steps: [{ date: "2026-03-16", title: "PRECARIA RENOVADA", detail: "" }],
    finished: false,
  };

  async function withBirthDate(core: ReturnType<typeof makeCore>, birthDate: string | null) {
    const userId = await newUser(core);
    await subscribe(userId);
    await prisma.user.update({ where: { id: userId }, data: { birthDate: birthDate ? new Date(birthDate) : null } });
    return userId;
  }

  it("needs the holder's birth date and sends it as DD/MM/YYYY", async () => {
    const seen: { number: string; birthDate: string; kind: string }[] = [];
    const core = makeCore({
      scraper: {
        dnm: async (input) => {
          seen.push(input);
          return answer;
        },
      },
    });
    const userId = await withBirthDate(core, null);
    expect(await core.trackers.addTramite(userId, "DNM_DNI", "1129912025")).toEqual({
      ok: false,
      reason: "BIRTH_DATE_REQUIRED",
    });

    await prisma.user.update({ where: { id: userId }, data: { birthDate: new Date("1990-03-05") } });
    expect(await core.trackers.addTramite(userId, "DNM_DNI", "1129912025")).toMatchObject({ ok: true });
    expect(await core.trackers.runDue()).toBe(1);
    expect(seen).toEqual([{ kind: "DNM_DNI", number: "1129912025", birthDate: "05/03/1990" }]);
    expect((await core.trackers.list(userId))[0]).toMatchObject({ kind: "DNM_DNI", status: "ACTIVE" });
  });

  it("uses the birth date typed for the case over the profile and lets it be corrected", async () => {
    const seen: string[] = [];
    const core = makeCore({
      scraper: {
        dnm: async (input) => {
          seen.push(input.birthDate);
          return answer;
        },
      },
    });
    const userId = await withBirthDate(core, "1990-03-05");
    const added = await core.trackers.addTramite(userId, "DNM_DNI", "1129912025", null, new Date("1985-12-31"));
    if (!added.ok) throw new Error("add failed");
    expect(added.tracker.holderBirthDate).toBe("1985-12-31");
    await core.trackers.runDue();
    expect(seen).toEqual(["31/12/1985"]);

    // never read successfully? it can still be corrected; here data arrived, so it cannot
    expect(await core.trackers.replaceNumber(userId, added.tracker.id, "1129912025", new Date("1990-03-05"))).toBe(
      "NOT_ALLOWED",
    );
  });

  it("shows only who the case belongs to before it is added, then stores that same read", async () => {
    let calls = 0;
    const core = makeCore({
      scraper: {
        dnm: async () => {
          calls += 1;
          return {
            ...answer,
            holder: "PEREZ ANA",
            header: { ...answer.header, office: "ENTRE RIOS", expediente: "50003732026" },
          };
        },
      },
    });
    const userId = await withBirthDate(core, "1990-03-05");
    const preview = await core.trackers.previewTramite(userId, "DNM_DNI", "1129912025");
    // identity only: no status, no steps
    expect(preview).toEqual({
      ok: true,
      header: { holder: "PEREZ ANA", office: "ENTRE RIOS", expediente: "50003732026" },
    });
    expect(await prisma.tracker.count({ where: { userId } })).toBe(0);

    const added = await core.trackers.addTramite(userId, "DNM_DNI", "1129912025");
    expect(added).toMatchObject({ ok: true });
    // the preview read was stored: the card is filled without a second request
    expect(calls).toBe(1);
    const [tracker] = await core.trackers.list(userId);
    expect(tracker!.steps).toHaveLength(1);
    expect(tracker!.header.status).toBe("PRECARIA RENOVADA");
  });

  it("frees the slot when the DNI file is resolved and tallies statuses without any personal data", async () => {
    let state = "EN TRAMITE";
    const core = makeCore({
      scraper: {
        dnm: async () => ({
          ...answer,
          header: { ...answer.header, state },
          finished: state === "RESUELTO",
        }),
      },
    });
    const userId = await withBirthDate(core, "1990-03-05");
    await prisma.user.update({ where: { id: userId }, data: { paidCases: 1 } });
    await core.trackers.addTramite(userId, "DNM_DNI", "1129912025");
    await core.trackers.runDue();
    expect(await core.billing.state(userId)).toMatchObject({ activeCases: 1, freeCases: 0 });

    state = "RESUELTO";
    await prisma.tracker.updateMany({ where: { userId }, data: { nextCheckAt: new Date() } });
    await core.trackers.runDue();
    expect(await core.billing.state(userId)).toMatchObject({ activeCases: 0, freeCases: 1, finishedCases: 1 });

    const stats = await core.trackers.statusStats("DNM_DNI");
    expect(stats.map((row) => [row.field, row.value, row.count])).toEqual(
      expect.arrayContaining([
        ["status", "EN TRAMITE", 1],
        ["status", "RESUELTO", 1],
        ["step", "PRECARIA RENOVADA", 1],
      ]),
    );
    // nothing links an observation to a user or a number
    expect(Object.keys(stats[0]!).sort()).toEqual(["count", "field", "firstSeenAt", "id", "kind", "lastSeenAt", "value"]);
  });

  it("offers a closed case, which is added as finished without a free slot or a notice", async () => {
    const core = makeCore({
      scraper: {
        dnm: async () => ({ ...answer, header: { ...answer.header, state: "RESUELTO" }, finished: true }),
      },
    });
    const userId = await withBirthDate(core, "1990-03-05");
    await prisma.user.update({ where: { id: userId }, data: { paidCases: 0, telegramId: 99n } });

    const preview = await core.trackers.previewTramite(userId, "DNM_DNI", "1129912025");
    expect(preview).toMatchObject({ ok: true, header: { closed: "true", state: "RESUELTO" } });

    const added = await core.trackers.addTramite(userId, "DNM_DNI", "1129912025");
    expect(added).toMatchObject({ ok: true });
    expect((await core.trackers.list(userId))[0]!.status).toBe("FINISHED");
    expect(await prisma.telegramOutbox.count()).toBe(0);
  });

  it("reports a rejected number/birth date in the preview", async () => {
    const core = makeCore({
      scraper: {
        dnm: async () => {
          throw new ScraperError("mismatch");
        },
      },
    });
    const userId = await withBirthDate(core, "1990-03-05");
    expect(await core.trackers.previewTramite(userId, "DNM_CITIZENSHIP", "2275808")).toEqual({
      ok: false,
      reason: "MISMATCH",
    });
  });

  it("keeps the case when the source rejects number and birth date, and retries on the regular cadence", async () => {
    const core = makeCore({
      scraper: {
        dnm: async () => {
          throw new ScraperError("mismatch");
        },
      },
    });
    const userId = await withBirthDate(core, "1990-03-05");
    await core.trackers.addTramite(userId, "DNM_CITIZENSHIP", "2275808");
    await core.trackers.runDue();
    const tracker = await prisma.tracker.findFirstOrThrow({ where: { userId } });
    expect(tracker.lastError).toBe("mismatch");
    const waitMs = tracker.nextCheckAt.getTime() - Date.now();
    expect(waitMs).toBeGreaterThan(TRACKER_CONFIG.retryAfterMinutes * 60_000);
  });
});

describe("final statuses end a case", () => {
  it("finishes a RENAPER case at Embalado and a court case at Archívese", async () => {
    const core = makeCore({
      scraper: {
        renaper: async () => renaperAnswer({ header: { status: "Embalado" } }),
        pjnCase: async () => ({
          header: { expediente: "CNE 7900/2026", dependencia: "J", sit_actual: "ARCHIVESE", caratula: "X" },
          actuaciones: [],
        }),
      },
    });
    const userId = await newUser(core);
    await subscribe(userId);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await core.trackers.addPjn(userId, { jurisdiction: "4", number: "7900", year: "2026" });
    await core.trackers.runDue(10);
    const byKind = Object.fromEntries((await core.trackers.list(userId)).map((item) => [item.kind, item.status]));
    expect(byKind).toEqual({ RENAPER: "FINISHED", PJN: "FINISHED" });
  });

  it("switches notifications off when a case finishes, but still delivers its last report", async () => {
    let status = "Verificado";
    const core = makeCore({ scraper: { renaper: async () => renaperAnswer({ header: { status } }) } });
    const userId = await newUser(core);
    await subscribe(userId);
    await prisma.user.update({ where: { id: userId }, data: { telegramId: 77n } });
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await core.trackers.runDue();
    for (const pending of await core.trackers.pendingNotifications()) await core.trackers.markNotified(pending.eventId);

    status = "Embalado";
    await prisma.tracker.updateMany({ where: { userId }, data: { nextCheckAt: new Date() } });
    await core.trackers.runDue();
    const [finished] = await core.trackers.list(userId);
    expect(finished).toMatchObject({ status: "FINISHED", notifyTelegram: false, notifyWhatsapp: false });

    // the report that closed the case was found while Telegram was on, so it is still sent
    const pending = await core.trackers.pendingNotifications();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.payload.header.status).toBe("Embalado");
    // and a closed case is left out of the digest
    expect(await core.trackers.latestSteps(userId)).toHaveLength(0);
  });

  it("adds a closed RENAPER or court case as finished: no slot, no notices, read once", async () => {
    let renaperCalls = 0;
    const core = makeCore({
      scraper: {
        renaper: async () => {
          renaperCalls += 1;
          return renaperAnswer({ header: { status: "Embalado", office: "RC PARANA" } });
        },
        pjnCase: async (input) =>
          input.headerOnly
            ? { header: { expediente: "CNE 7900/2026", dependencia: "J", sit_actual: "ARCHIVESE", caratula: "X" } }
            : {
                header: { expediente: "CNE 7900/2026", dependencia: "J", sit_actual: "ARCHIVESE", caratula: "X" },
                actuaciones: [{ orden: 1, fecha: "3/09/2026", oficina: "", tipo: "ARCHIVESE", detalle: "" }],
              },
      },
    });
    const userId = await newUser(core);
    await prisma.user.update({ where: { id: userId }, data: { telegramId: 5n } });
    // trial user who already uses its single case: a closed one still goes in
    await prisma.user.update({ where: { id: userId }, data: { subscriptionUntil: null } });
    const open = makeCore({ scraper: { renaper: async () => renaperAnswer() } });
    await open.trackers.addTramite(userId, "CORREO", "100000001");

    const preview = await core.trackers.previewTramite(userId, "RENAPER", "755824304");
    expect(preview).toMatchObject({ ok: true, header: { closed: "true", state: "Embalado" } });
    expect(await core.trackers.addTramite(userId, "RENAPER", "755824304")).toMatchObject({ ok: true });
    expect(renaperCalls).toBe(1);

    expect(await core.trackers.previewPjn(userId, { jurisdiction: "4", number: "7900", year: "2026" })).toMatchObject({
      ok: true,
      header: { closed: "true" },
    });
    expect(await core.trackers.addPjn(userId, { jurisdiction: "4", number: "7900", year: "2026" })).toMatchObject({
      ok: true,
    });
    const byKind = Object.fromEntries((await core.trackers.list(userId)).map((item) => [item.kind, item]));
    expect(byKind.RENAPER).toMatchObject({ status: "FINISHED", notifyTelegram: false });
    expect(byKind.PJN).toMatchObject({ status: "FINISHED", notifyTelegram: false });
    expect(byKind.PJN!.steps).toHaveLength(1);
    expect(await prisma.telegramOutbox.count()).toBe(0);
  });

  it("closes an active case whose stored status is already final, without waiting for a check", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await subscribe(userId);
    const added = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!added.ok) throw new Error("add failed");
    await prisma.trackerSnapshot.create({
      data: { trackerId: added.tracker.id, header: { status: "Embalado" }, steps: [], contentHash: "h" },
    });
    await prisma.tracker.update({ where: { id: added.tracker.id }, data: { nextCheckAt: new Date(Date.now() + 3_600_000) } });

    expect(await core.trackers.closeFinished()).toBe(1);
    expect((await core.trackers.list(userId))[0]).toMatchObject({ status: "FINISHED", notifyTelegram: false });
    expect(await core.trackers.closeFinished()).toBe(0);
  });

  it("finishes a Correo case when the latest stage is delivery", async () => {
    const core = makeCore({
      scraper: {
        correo: async () =>
          renaperAnswer({
            steps: [
              { date: "2026-10-10", title: "EN VIAJE", detail: "" },
              { date: "2026-10-12", title: "ENTREGADO", detail: "" },
            ],
          }),
      },
    });
    const userId = await newUser(core);
    await subscribe(userId);
    await core.trackers.addTramite(userId, "CORREO", "755824304");
    await core.trackers.runDue();
    expect((await core.trackers.list(userId))[0]!.status).toBe("FINISHED");
  });
});

describe("trackers: Correo forms", () => {
  it("passes the form, prefix and code of a stored reference to the scraper", async () => {
    const asked: string[] = [];
    const core = makeCore({
      scraper: {
        correo: async (reference: string) => {
          asked.push(reference);
          return renaperAnswer();
        },
      },
    });
    const userId = await newUser(core);
    await subscribe(userId);
    expect(await core.trackers.addTramite(userId, "CORREO", "ondnp:CU:123456789")).toMatchObject({ ok: true });
    expect(await core.trackers.addTramite(userId, "CORREO", "oidn:AB123456789CD")).toMatchObject({ ok: true });
    await core.trackers.runDue();
    expect(asked.sort()).toEqual(["oidn:AB123456789CD", "ondnp:CU:123456789"]);
  });

  it("keeps parcels with the same code under another prefix apart", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await subscribe(userId);
    await core.trackers.addTramite(userId, "CORREO", "ondnp:CU:123456789");
    expect(await core.trackers.addTramite(userId, "CORREO", "ondnp:SU:123456789")).toMatchObject({ ok: true });
    expect(await core.trackers.addTramite(userId, "CORREO", "ondnp:CU:123456789")).toMatchObject({
      ok: false,
      reason: "ALREADY_EXISTS",
    });
  });

  it("only replaces a code with a valid reference of its own kind", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await subscribe(userId);
    const correo = await core.trackers.addTramite(userId, "CORREO", "ondnp:CU:123456789");
    const renaper = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!correo.ok || !renaper.ok) throw new Error("add failed");
    expect(await core.trackers.replaceNumber(userId, correo.tracker.id, "ondnp:ZZ:1234567")).toBe("NOT_ALLOWED");
    expect(await core.trackers.replaceNumber(userId, renaper.tracker.id, "ondnp:CU:1234567")).toBe("NOT_ALLOWED");
    expect(await core.trackers.replaceNumber(userId, correo.tracker.id, "ondnp:CU:987654321")).toBe("OK");
  });
});

describe("the same case is never added twice", () => {
  it("refuses a repeat in every section, whatever state the first one is in", async () => {
    const header = { expediente: "CNE 7900/2026", dependencia: "J", sit_actual: "ARCHIVESE", caratula: "X" };
    const core = makeCore({
      scraper: {
        renaper: async () => renaperAnswer({ header: { status: "Embalado" }, finished: true }),
        correo: async () => renaperAnswer(),
        dnm: async () => ({ found: true, header: { status: "X", state: "RESUELTO" }, steps: [], finished: true }),
        pjnCase: async () => ({ header, actuaciones: [] }),
      },
    });
    const userId = await newUser(core);
    await prisma.user.update({ where: { id: userId }, data: { birthDate: new Date("1990-03-05") } });
    await subscribe(userId);
    const input = { jurisdiction: "4", number: "7900", year: "2026" };

    // the first of each is added (RENAPER, DNI and the court case end up finished, Correo stays open)
    for (const kind of ["RENAPER", "CORREO", "DNM_DNI", "DNM_CITIZENSHIP"] as const) {
      expect(await core.trackers.addTramite(userId, kind, "755824304")).toMatchObject({ ok: true });
    }
    expect(await core.trackers.addPjn(userId, input)).toMatchObject({ ok: true });

    for (const kind of ["RENAPER", "CORREO", "DNM_DNI", "DNM_CITIZENSHIP"] as const) {
      expect(await core.trackers.previewTramite(userId, kind, "755824304")).toEqual({
        ok: false,
        reason: "ALREADY_EXISTS",
      });
      expect(await core.trackers.addTramite(userId, kind, "755824304")).toEqual({
        ok: false,
        reason: "ALREADY_EXISTS",
      });
    }
    expect(await core.trackers.previewPjn(userId, input)).toEqual({ ok: false, reason: "ALREADY_EXISTS" });
    expect(await core.trackers.addPjn(userId, input)).toEqual({ ok: false, reason: "ALREADY_EXISTS" });
    expect(await prisma.tracker.count({ where: { userId } })).toBe(5);
  });
});

describe("notification switches per case", () => {
  it("starts on and belongs to the owner of the case", async () => {
    const core = makeCore({ scraper: { renaper: async () => renaperAnswer() } });
    const userId = await newUser(core);
    await subscribe(userId);
    const own = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!own.ok) throw new Error("add failed");
    expect(own.tracker).toMatchObject({ notifyTelegram: true, notifyWhatsapp: false });

    const stranger = await newUser(core, "other@example.com");
    expect(await core.trackers.setNotify(stranger, own.tracker.id, false)).toBe(false);
    expect(await core.trackers.setNotify(userId, own.tracker.id, false)).toBe(true);
    expect((await core.trackers.list(userId))[0]!.notifyTelegram).toBe(false);
  });
});

describe("cases: the subscription is priced per tracked case", () => {
  it("lets as many cases in as were paid for, in any section", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await core.billing.checkout(userId, 2);
    expect(await core.trackers.addTramite(userId, "RENAPER", "100000001")).toMatchObject({ ok: true });
    // the same section twice: nothing ties a case to a section
    expect(await core.trackers.addTramite(userId, "RENAPER", "100000002")).toMatchObject({ ok: true });
    expect(await core.trackers.addTramite(userId, "CORREO", "100000001")).toMatchObject({
      ok: false,
      reason: "NO_FREE_SLOT",
    });

    // more cases are paid at once, as the difference of the price ladder
    expect(await core.billing.checkout(userId, 3)).toMatchObject({
      ok: true,
      quote: { mode: "extra", amount: casesPrice(3) - casesPrice(2), addCases: 1 },
    });
    expect(await core.trackers.addTramite(userId, "CORREO", "100000001")).toMatchObject({ ok: true });
    const payments = await core.billing.history(userId);
    expect(payments.map((p) => [p.kind, p.amount, p.casesDelta]).reverse()).toEqual([
      ["subscription", casesPrice(2), 2],
      ["cases", casesPrice(3) - casesPrice(2), 1],
    ]);
  });

  it("stops at the configured maximum and refuses fewer cases than paid", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    expect(await core.billing.checkout(userId, 101)).toEqual({ ok: false, reason: "LIMIT_REACHED" });
    await core.billing.checkout(userId, 3);
    expect(await core.billing.checkout(userId, 2)).toEqual({ ok: false, reason: "INVALID_CASES" });
  });

  it("frees a slot when a case is finished", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await core.billing.checkout(userId, 1);
    const first = await core.trackers.addTramite(userId, "RENAPER", "100000001");
    if (!first.ok) throw new Error("add failed");
    await core.trackers.finish(userId, first.tracker.id);
    expect(await core.trackers.addTramite(userId, "RENAPER", "100000002")).toMatchObject({ ok: true });
    expect((await core.billing.state(userId)).finishedCases).toBe(1);
  });

  it("tells the owner when a case is finished and its slot is free", async () => {
    const core = makeCore({
      scraper: { renaper: async () => renaperAnswer({ finished: true }) },
    });
    const userId = await newUser(core);
    await prisma.user.update({ where: { id: userId }, data: { telegramId: 4242n } });
    await core.billing.checkout(userId, 1);
    await core.trackers.addTramite(userId, "RENAPER", "100000001");
    await core.trackers.runDue();
    const rows = await prisma.telegramOutbox.findMany();
    expect(rows.map((row) => [row.kind, row.payload])).toEqual([["case_finished", { caseId: "100000001" }]]);
    expect((await core.trackers.list(userId))[0]!.status).toBe("FINISHED");
  });

  it("takes a case out of the subscription at the period end and keeps it as history", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await core.billing.checkout(userId, 3);
    const ids: string[] = [];
    for (const number of ["100000001", "100000002", "100000003"]) {
      const added = await core.trackers.addTramite(userId, "RENAPER", number);
      if (!added.ok) throw new Error("add failed");
      ids.push(added.tracker.id);
    }

    expect(await core.billing.setKept(userId, ids[1]!, false)).toEqual({ ok: true });
    // it keeps running and is still paid until the period ends; the next period is cheaper
    const during = await core.billing.state(userId);
    expect(during).toMatchObject({
      paidCases: 3,
      activeCases: 3,
      cancelledCases: 1,
      keptCases: 2,
      currentPrice: casesPrice(3),
      nextPeriodPrice: casesPrice(2),
    });
    expect((await core.trackers.list(userId)).every((item) => item.status === "ACTIVE")).toBe(true);

    // taking it back changes nothing
    await core.billing.setKept(userId, ids[1]!, true);
    expect((await core.billing.state(userId)).nextPeriodPrice).toBe(casesPrice(3));
    await core.billing.setKept(userId, ids[1]!, false);

    const renewed = await core.billing.renew(userId);
    expect(renewed).toMatchObject({ ok: true, quote: { amount: casesPrice(2) } });
    const after = await core.trackers.list(userId);
    expect(Object.fromEntries(after.map((item) => [item.reference, item.status]))).toEqual({
      "100000001": "ACTIVE",
      "100000002": "PAUSED",
      "100000003": "ACTIVE",
    });
    // the case is not deleted, however long it stays paused
    expect(await prisma.tracker.count({ where: { userId } })).toBe(3);
    expect(await core.billing.state(userId)).toMatchObject({ paidCases: 2, pausedCases: 1 });

    // back under tracking: needs a free slot first
    expect(await core.billing.resume(userId, ids[1]!)).toEqual({ ok: false, reason: "NO_FREE_SLOT" });
    await core.billing.checkout(userId, 3);
    expect(await core.billing.resume(userId, ids[1]!)).toEqual({ ok: true });
    expect((await core.trackers.list(userId)).find((item) => item.id === ids[1])!.status).toBe("ACTIVE");
  });

  it("cancelling the subscription only stops renewal: cases and marks are untouched", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    await core.billing.checkout(userId, 2);
    const first = await core.trackers.addTramite(userId, "RENAPER", "100000001");
    await core.trackers.addTramite(userId, "CORREO", "100000001");
    if (!first.ok) throw new Error("add failed");
    // one case is marked for removal: it only changes what the next period costs
    await core.billing.setKept(userId, first.tracker.id, false);
    const before = await core.billing.state(userId);
    expect(before).toMatchObject({ renews: true, keptCases: 1, cancelledCases: 1, nextPeriodPrice: casesPrice(1) });

    expect(await core.billing.setRenewal(userId, false)).toEqual({ ok: true });
    const cancelled = await core.billing.state(userId);
    expect(cancelled).toMatchObject({ renews: false, activeCases: 2, keptCases: 1, cancelledCases: 1 });
    expect((await core.trackers.list(userId)).map((item) => item.status)).toEqual(["ACTIVE", "ACTIVE"]);
    // nothing renews, so there is nothing to simulate
    expect(await core.billing.renew(userId)).toEqual({ ok: false, reason: "CANCELLED" });

    // returning it before the period ends restores renewal and changes nothing else
    expect(await core.billing.setRenewal(userId, true)).toEqual({ ok: true });
    expect(await core.billing.state(userId)).toMatchObject({ ...before });
  });

  it("restarts after the period ended with the cases that stayed", async () => {
    let clock = new Date("2026-10-14T10:00:00Z");
    const core = makeCore({ now: () => clock });
    const userId = await newUser(core);
    await core.billing.checkout(userId, 3);
    const first = await core.trackers.addTramite(userId, "RENAPER", "100000001");
    const second = await core.trackers.addTramite(userId, "RENAPER", "100000002");
    if (!first.ok || !second.ok) throw new Error("add failed");
    await core.billing.setKept(userId, second.tracker.id, false);

    clock = new Date(clock.getTime() + 31 * 86_400_000);
    // the old period pays for nothing; fewer cases than kept ones is refused
    expect((await core.billing.state(userId)).paidCases).toBe(0);
    expect(await core.billing.checkout(userId, 1)).toMatchObject({ ok: true, quote: { amount: casesPrice(1) } });
    expect((await core.trackers.list(userId)).map((item) => item.status).sort()).toEqual(["ACTIVE", "PAUSED"]);
  });
});

describe("replacing and releasing a case", () => {
  it("fixes a mistyped number only while nothing was ever read for it", async () => {
    const core = makeCore({ scraper: { renaper: async () => renaperAnswer() } });
    const userId = await newUser(core);
    const added = await core.trackers.addTramite(userId, "RENAPER", "100000001");
    if (!added.ok) throw new Error("add failed");
    expect(await core.trackers.replaceNumber(userId, added.tracker.id, "100000009")).toBe("OK");
    await core.trackers.runDue(); // data arrives
    expect(await core.trackers.replaceNumber(userId, added.tracker.id, "100000010")).toBe("NOT_ALLOWED");
  });

  it("allows a replacement once every 30 days and starts the new case afresh", async () => {
    // slotSince comes from the database clock, so the fake clock must start at the real now
    let clock = new Date(Date.now() + 60_000);
    const core = makeCore({
      now: () => clock,
      scraper: { renaper: async () => renaperAnswer() },
    });
    const userId = await newUser(core);
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionUntil: new Date("2027-06-01T00:00:00Z"), paidCases: 1 },
    });
    const added = await core.trackers.addTramite(userId, "RENAPER", "100000001");
    if (!added.ok) throw new Error("add failed");
    await core.trackers.runDue();

    const early = (await core.trackers.list(userId))[0]!;
    expect(early.canReplace).toBe(false);
    expect(early.replaceAvailableAt).not.toBeNull();
    expect(await core.trackers.replaceNumber(userId, added.tracker.id, "100000002")).toBe("NOT_ALLOWED");

    clock = new Date(clock.getTime() + 30 * 86_400_000);
    expect((await core.trackers.list(userId))[0]!.canReplace).toBe(true);
    expect(await core.trackers.replaceNumber(userId, added.tracker.id, "100000002")).toBe("OK");
    const fresh = (await core.trackers.list(userId))[0]!;
    // nothing read yet for the new number: it still counts as correctable
    expect(fresh).toMatchObject({ reference: "100000002", steps: [] });
    await core.trackers.runDue();
    // once data arrived the cooldown applies again
    expect((await core.trackers.list(userId))[0]!).toMatchObject({ canReplace: false, steps: expect.any(Array) });
  });

  it("does not treat an unpaid status as a reason to replace: the payment may still be fixed", async () => {
    const core = makeCore({
      scraper: {
        renaper: async () =>
          renaperAnswer({
            header: { status: "El trámite (eDNI) se exportó y no se imprimió por falta de pago" },
          }),
      },
    });
    const userId = await newUser(core);
    const added = await core.trackers.addTramite(userId, "RENAPER", "753787346");
    if (!added.ok) throw new Error("add failed");
    await core.trackers.runDue();
    expect((await core.trackers.list(userId))[0]!.canReplace).toBe(false);
    expect(await core.trackers.replaceNumber(userId, added.tracker.id, "755824304")).toBe("NOT_ALLOWED");
  });

  it("frees the slot of a confirmed court case only after the cooldown", async () => {
    let clock = new Date("2026-10-14T10:00:00Z");
    const core = makeCore({
      now: () => clock,
      scraper: {
        pjnCase: async (input) =>
          input.headerOnly
            ? { header: { expediente: "CNE 007900/2026", dependencia: "J", sit_actual: "GIRO", caratula: "X" } }
            : { header: { expediente: "CNE 007900/2026", dependencia: "J", sit_actual: "GIRO", caratula: "X" }, actuaciones: [] },
      },
    });
    const userId = await newUser(core);
    const started = await core.trackers.startPjn(userId, { jurisdiction: "4", number: "7900", year: "2026" });
    if (!started.ok) throw new Error("start failed");
    await core.trackers.confirmPjn(userId, started.tracker.id);
    await core.trackers.runDue();
    expect(await core.trackers.releaseCase(userId, started.tracker.id)).toBe(false);
    clock = new Date(clock.getTime() + 31 * 86_400_000);
    expect(await core.trackers.releaseCase(userId, started.tracker.id)).toBe(true);
    expect(await core.trackers.list(userId)).toHaveLength(0);
  });

  it("names the case by number in notifications and the digest", async () => {
    const core = makeCore({ scraper: { renaper: async () => renaperAnswer() } });
    const userId = await newUser(core);
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await core.trackers.runDue();
    const digest = await core.trackers.latestSteps(userId);
    expect(digest[0]!.caseId).toBe("755824304");
  });
});

describe("two-step adding of a court case", () => {
  const header = { expediente: "CNE 007900/2026", dependencia: "J", sit_actual: "GIRO", caratula: "MEDVEDEV, EGOR S/NAC" };

  it("shows the header first, stores nothing, and adds with the same read after confirmation", async () => {
    let reads = 0;
    const core = makeCore({
      scraper: {
        pjnCase: async () => {
          reads += 1;
          return { header };
        },
      },
    });
    const userId = await newUser(core);
    const input = { jurisdiction: "4", number: "7900", year: "2026" };

    const preview = await core.trackers.previewPjn(userId, input);
    expect(preview).toEqual({ ok: true, header });
    expect(await core.trackers.list(userId)).toHaveLength(0); // nothing stored yet

    const added = await core.trackers.addPjn(userId, input);
    expect(added).toMatchObject({ ok: true, tracker: { status: "ACTIVE", kind: "PJN" } });
    expect(reads).toBe(1); // no second captcha for the confirmation
  });

  it("reports a missing case in the preview and blocks a second case in the section", async () => {
    const core = makeCore({
      scraper: {
        pjnCase: async () => {
          throw new ScraperError("not_found");
        },
      },
    });
    const userId = await newUser(core);
    expect(await core.trackers.previewPjn(userId, { jurisdiction: "4", number: "1", year: "2026" })).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
    const ok = makeCore({ scraper: { pjnCase: async () => ({ header }) } });
    await ok.trackers.addPjn(userId, { jurisdiction: "4", number: "7900", year: "2026" });
    expect(await ok.trackers.previewPjn(userId, { jurisdiction: "4", number: "7901", year: "2026" })).toMatchObject({
      ok: false,
      reason: "SUBSCRIPTION_REQUIRED",
    });
  });
});

describe("custom name of a case", () => {
  it("keeps the user's name and exposes when the slot was filled", async () => {
    const { addTrackerRequestSchema } = await import("@ojo/shared");
    const parsed = addTrackerRequestSchema.parse({ kind: "RENAPER", number: "755824304", label: "  Мама  " });
    expect(parsed.label).toBe("Мама");
    expect(addTrackerRequestSchema.parse({ kind: "RENAPER", number: "755824304", label: "   " }).label).toBeNull();
    expect(
      addTrackerRequestSchema.safeParse({ kind: "RENAPER", number: "755824304", label: "x".repeat(61) }).success,
    ).toBe(false);

    const core = makeCore();
    const userId = await newUser(core);
    const added = await core.trackers.addTramite(userId, "RENAPER", "755824304", "Мама");
    if (!added.ok) throw new Error("add failed");
    expect(added.tracker.label).toBe("Мама");
    expect(new Date(added.tracker.addedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});

describe("renaming and removing a case that has not started", () => {
  it("renames any time", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    const added = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!added.ok) throw new Error("add failed");
    expect(await core.trackers.setLabel(userId, added.tracker.id, "Папа")).toBe(true);
    expect((await core.trackers.list(userId))[0]!.label).toBe("Папа");
    // somebody else's case cannot be renamed
    const other = await newUser(core, "other@example.com");
    expect(await core.trackers.setLabel(other, added.tracker.id, "X")).toBe(false);
  });

  it("can be removed only while nothing was read; afterwards the 30-day rule applies", async () => {
    const core = makeCore({ scraper: { renaper: async () => renaperAnswer() } });
    const userId = await newUser(core);
    const added = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!added.ok) throw new Error("add failed");
    expect((await core.trackers.list(userId))[0]).toMatchObject({ notStarted: true, canReplace: true });

    await core.trackers.runDue(); // tracking starts: the first data arrived
    expect((await core.trackers.list(userId))[0]).toMatchObject({ notStarted: false, canReplace: false });
    expect(await core.trackers.releaseCase(userId, added.tracker.id)).toBe(false);

    const second = await core.trackers.addTramite(userId, "CORREO", "755824304");
    expect(second).toMatchObject({ ok: false }); // trial covers one case: stay with the first
  });

  it("allows deleting a never-read number at once and frees the slot", async () => {
    const core = makeCore();
    const userId = await newUser(core);
    const added = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!added.ok) throw new Error("add failed");
    expect(await core.trackers.releaseCase(userId, added.tracker.id)).toBe(true);
    expect(await core.trackers.list(userId)).toHaveLength(0);
  });
});
