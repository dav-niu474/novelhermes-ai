import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// For Supabase PostgreSQL with Prisma:
// - DATABASE_URL uses the pooled connection (pgbouncer) for runtime queries
// - DIRECT_URL uses the direct connection for migrations
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
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
