import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

export * from "./generated/client";

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalStore = globalThis as unknown as { __ojoPrisma?: PrismaClient };

/** Shared client for the running process (survives Next.js hot reloads in dev). */
export function getPrisma(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  globalStore.__ojoPrisma ??= createPrismaClient(connectionString);
  return globalStore.__ojoPrisma;
}
