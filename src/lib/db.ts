import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Initialize DB schema on Vercel cold starts
if (process.env.VERCEL) {
  db.$connect().then(async () => {
    try {
      // Check if tables exist by querying
      await db.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' LIMIT 1`
    } catch {
      // Tables don't exist yet - need to create them
      console.log('Initializing database schema on Vercel...')
      try {
        const { execSync } = await import('child_process')
        execSync('npx prisma db push --skip-generate --accept-data-loss 2>&1', {
          stdio: 'pipe',
          timeout: 30000,
        })
        console.log('Database schema initialized successfully')
      } catch (err) {
        console.error('Failed to initialize database schema:', err)
      }
    }
  })
}
