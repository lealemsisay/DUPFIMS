import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

config({ path: resolve(process.cwd(), ".env"), override: true });
config({ path: resolve(process.cwd(), "backend", ".env") });

const globalForPrisma = globalThis as unknown as {
  backendPrisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.backendPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.backendPrisma = prisma;
}
