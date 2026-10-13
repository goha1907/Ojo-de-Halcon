import { createCoreFromEnv, type Core } from "@ojo/core";
import { getEnv } from "./env";

const globalStore = globalThis as unknown as { __ojoCore?: Core };

/** Core services for this server process (shared across requests and hot reloads). */
export function getCore(): Core {
  globalStore.__ojoCore ??= createCoreFromEnv(getEnv());
  return globalStore.__ojoCore;
}
