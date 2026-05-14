// ensure we use the binary engine type so the client constructor does not
// require an adapter/accelerateUrl (Prisma v7 default `client` engine needs one)
process.env.PRISMA_CLIENT_ENGINE_TYPE = process.env.PRISMA_CLIENT_ENGINE_TYPE || 'binary';

import { PrismaClient } from '@prisma/client';

/**
 * Export a singleton Prisma client with the same fallback logic we used
 * in index.ts previously, so that every module can import it safely.
 */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

let prisma: any;
try {
  // provide a driver adapter for SQLite so the client can initialize
  prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL || "file:./dev.db",
    }, {
      // additional adapter options can go here
    }),
  });
} catch (err: any) {
  console.warn('⚠️  Could not initialize Prisma client; falling back to a mock. Error:', err?.message ?? err);
  prisma = {
    user: {
      findMany: async () => []
    },
    vehicle: {
      findMany: async () => [],
      create: async ({ data }: any) => ({ id: -1, ...data }),
      update: async ({ where, data }: any) => ({ id: where.id, ...data }),
      delete: async ({ where }: any) => ({}),
    },
    $connect: async () => {},
    $disconnect: async () => {}
  };
}

export default prisma;
