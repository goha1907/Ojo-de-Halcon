import { spawn } from "node:child_process";
import { CORREO_FORMS, parseCorreoReference, type TrackerStep } from "@ojo/shared";

export interface ScrapedTramite {
  found: boolean;
  header: Record<string, string>;
  steps: TrackerStep[];
  finished: boolean;
  /** Migraciones only: the holder's name, shown once for confirmation and never stored. */
  holder?: string;
}

export interface PjnPartyRow {
  expediente: string;
  dependencia: string;
  caratula: string;
  situacion: string;
  ultima_actuacion: string;
}

export interface PjnCaseResult {
  header: { expediente: string; dependencia: string; sit_actual: string; caratula: string };
  /** Oldest first; absent for `headerOnly` calls. */
  actuaciones?: { orden: number; fecha: string; oficina: string; tipo: string; detalle: string }[];
}

/** Boundary to the data sources (public sites). Faked in tests. */
export interface Scraper {
  /** RENAPER status of a trámite number. */
  renaper(number: string): Promise<ScrapedTramite>;
  /** Correo Argentino shipment of a stored reference (see `parseCorreoReference`); independent of RENAPER. */
  correo(reference: string): Promise<ScrapedTramite>;
  /** Migraciones (DNM): needs the holder's birth date as DD/MM/YYYY next to the number. */
  dnm(input: { kind: "DNM_DNI" | "DNM_CITIZENSHIP"; number: string; birthDate: string }): Promise<ScrapedTramite>;
  pjnParty(input: { jurisdiction: string; name: string }): Promise<PjnPartyRow[]>;
  pjnCase(input: {
    jurisdiction: string;
    number: string;
    year: string;
    headerOnly?: boolean;
  }): Promise<PjnCaseResult>;
}

export class ScraperError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ScraperError";
  }
}

export interface ProcessScraperOptions {
  /** Python interpreter of the scraper virtualenv. */
  python: string;
  /** Directory containing the `scraper` package. */
  cwd: string;
  timeoutMs: number;
  /** Browsers running at the same time. */
  concurrency: number;
}

/** Runs `python -m scraper <args>` and parses the single JSON line it prints. */
export function createProcessScraper(options: ProcessScraperOptions): Scraper {
  let running = 0;
  const waiting: (() => void)[] = [];

  async function acquire(): Promise<void> {
    if (running < options.concurrency) {
      running += 1;
      return;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  }

  function release(): void {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  }

  function exec(args: string[], env?: Record<string, string>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const child = spawn(options.python, ["-m", "scraper", ...args], {
        cwd: options.cwd,
        env: env ? { ...process.env, ...env } : process.env,
      });
      let out = "";
      const timer = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs);
      child.stdout.on("data", (chunk: Buffer) => (out += chunk.toString("utf8")));
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new ScraperError("spawn_failed", error.message));
      });
      child.on("close", () => {
        clearTimeout(timer);
        const line = out.trim().split("\n").pop() ?? "";
        try {
          resolve(JSON.parse(line));
        } catch {
          reject(new ScraperError("bad_output", line.slice(0, 200)));
        }
      });
    });
  }

  async function call<T>(args: string[], env?: Record<string, string>): Promise<T> {
    await acquire();
    try {
      const result = (await exec(args, env)) as { ok: boolean; error?: string; message?: string } & T;
      if (!result.ok) throw new ScraperError(result.error ?? "failed", result.message);
      return result;
    } finally {
      release();
    }
  }

  return {
    renaper: (number) => call<ScrapedTramite>(["renaper", "--number", number]),
    correo(reference) {
      const parsed = parseCorreoReference(reference);
      if (!parsed) return Promise.reject(new ScraperError("bad_number"));
      return call<ScrapedTramite>([
        "correo",
        "--action",
        CORREO_FORMS[parsed.form].action,
        "--number",
        parsed.id,
        ...(parsed.producto ? ["--producto", parsed.producto] : []),
      ]);
    },
    // the birth date travels in the environment of the child, never in its argument list
    dnm: ({ kind, number, birthDate }) =>
      call<ScrapedTramite>([kind === "DNM_DNI" ? "dnm-dni" : "dnm-citizenship", "--number", number], {
        SCRAPER_BIRTH_DATE: birthDate,
      }),
    async pjnParty({ jurisdiction, name }) {
      const result = await call<{ results: PjnPartyRow[] }>([
        "pjn-party",
        "--jurisdiction",
        jurisdiction,
        "--name",
        name,
      ]);
      return result.results;
    },
    pjnCase({ jurisdiction, number, year, headerOnly }) {
      return call<PjnCaseResult>([
        "pjn-case",
        "--jurisdiction",
        jurisdiction,
        "--number",
        number,
        "--year",
        year,
        ...(headerOnly ? ["--header-only"] : []),
      ]);
    },
  };
}
