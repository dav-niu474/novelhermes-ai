import { PrismaClient } from '@prisma/client'

// ─── Robust Database URL Resolution ──────────────────────────────────────
// Vercel production environment may NOT have DATABASE_URL/DIRECT_URL set
// (they might be empty). The Vercel Supabase integration creates vars
// with the project-name prefix like novelhermes_POSTGRES_*.
//
// We must ensure DATABASE_URL and DIRECT_URL are ALWAYS set to valid
// postgres URLs BEFORE PrismaClient is instantiated, because Prisma
// validates the schema's url = env("DATABASE_URL") at module load time.
//
// Resolution order for the runtime database URL:
// 1. novelhermes_POSTGRES_PRISMA_URL (Vercel Supabase pooled connection)
// 2. DATABASE_URL (if it's a valid postgres URL)
// 3. DIRECT_URL (direct PostgreSQL connection fallback)
// 4. novelhermes_POSTGRES_URL_NON_POOLING (Vercel Supabase direct)
// 5. novelhermes_POSTGRES_URL (Vercel Supabase pooled)
const env = process.env

function resolveDbUrl(...candidates: (string | undefined)[]): string {
  for (const url of candidates) {
    if (url && url.startsWith('postgres')) return url
  }
  return ''
}

// Resolve runtime URLs
const runtimeDbUrl = resolveDbUrl(
  env.novelhermes_POSTGRES_PRISMA_URL,
  env.DATABASE_URL,
  env.DIRECT_URL,
  env.novelhermes_POSTGRES_URL_NON_POOLING,
  env.novelhermes_POSTGRES_URL,
)

const runtimeDirectUrl = resolveDbUrl(
  env.novelhermes_POSTGRES_URL_NON_POOLING,
  env.DIRECT_URL,
  env.DATABASE_URL,
  env.novelhermes_POSTGRES_PRISMA_URL,
)

// CRITICAL: Ensure DATABASE_URL and DIRECT_URL are always set to valid
// postgres URLs before Prisma Client reads them from env()
if (!env.DATABASE_URL || !env.DATABASE_URL.startsWith('postgres')) {
  if (runtimeDbUrl) env.DATABASE_URL = runtimeDbUrl
}
if (!env.DIRECT_URL || !env.DIRECT_URL.startsWith('postgres')) {
  if (runtimeDirectUrl) env.DIRECT_URL = runtimeDirectUrl
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
