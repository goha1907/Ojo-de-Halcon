import { loadEnv, type Env } from "@ojo/shared";

export function getEnv(): Env {
  return loadEnv();
}
