import { createCoreFromEnv, type Core } from "@ojo/core";
import { getEnv } from "./env";

const globalStore = globalThis as unknown as { __ojoCore?: Core };
let moduleCore: Core | undefined;

/**
 * Core services for this server process. In production one instance lives on
 * `globalThis`. In development it is cached per module instance instead, so a
 * hot reload after changing `@ojo/core` builds a fresh object rather than
 * serving a stale one that lacks the new services.
 */
export function getCore(): Core {
  if (process.env.NODE_ENV === "production") {
    globalStore.__ojoCore ??= createCoreFromEnv(getEnv());
    return globalStore.__ojoCore;
  }
  moduleCore ??= createCoreFromEnv(getEnv());
  return moduleCore;
}
