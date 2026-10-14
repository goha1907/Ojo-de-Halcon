import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/client";

export * from "./generated/client";

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

interface Cached {
  client: PrismaClient;
  /** Model names of the generated client the instance was created from. */
  signature: string;
}

const globalStore = globalThis as unknown as { __ojoPrisma?: Cached };
const SIGNATURE = Object.keys(Prisma.ModelName).join(",");

/**
 * Shared client for the running process (survives Next.js hot reloads in dev).
 * A cached client built from an older generated schema is replaced, so adding
 * a model never needs a manual restart of a long-running dev server.
 */
export function getPrisma(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const cached = globalStore.__ojoPrisma;
  if (cached && cached.signature === SIGNATURE) return cached.client;
  // an entry written by an older version of this file has no `client`
  if (cached?.client) void cached.client.$disconnect();
  const client = createPrismaClient(connectionString);
  globalStore.__ojoPrisma = { client, signature: SIGNATURE };
  return client;
}
