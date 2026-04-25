import { PrismaClient } from '@prisma/client'

// ─── Fix system DATABASE_URL override issue ─────────────────────────────────
// The sandbox system may set DATABASE_URL to an old SQLite path (file:...),
// which overrides .env/.env.local files since system env vars have highest priority.
// We must override it BEFORE PrismaClient is instantiated, because Prisma validates
// the schema's url = env("DATABASE_URL") at module load time.
// 
// Resolution order for the runtime database URL:
// 1. novelhermes_POSTGRES_PRISMA_URL (Vercel Supabase pooled connection)
// 2. DIRECT_URL (from .env.local - direct PostgreSQL connection)
// 3. DATABASE_URL (fallback - may be invalid if overridden by system)
const runtimeDbUrl =
  process.env.novelhermes_POSTGRES_PRISMA_URL ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  ''

// Override DATABASE_URL for Prisma schema validation if the current one is invalid
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgres')) {
  if (runtimeDbUrl && runtimeDbUrl.startsWith('postgres')) {
    process.env.DATABASE_URL = runtimeDbUrl
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: runtimeDbUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Graceful shutdown - prevent hanging connections
if (typeof process !== 'undefined') {
  const shutdown = async () => {
    try {
      await db.$disconnect()
    } catch {
      // Ignore disconnect errors
    }
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
