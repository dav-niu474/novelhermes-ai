import { db } from '@/lib/db'

// ─── Shared Prisma Include Patterns ──────────────────────────────────────────
// Lightweight include for list views (no deep nesting)
const PROJECT_LIGHT_INCLUDE = {
  characters: true,
  worldRules: true,
  volumes: {
    include: {
      stages: {
        include: {
          units: {
            include: {
              chapters: {
                orderBy: { order: 'asc' as const },
              },
            },
            orderBy: { order: 'asc' as const },
          },
        },
        orderBy: { order: 'asc' as const },
      },
    },
    orderBy: { order: 'asc' as const },
  },
  plotLines: {
    include: { plotPoints: { orderBy: { order: 'asc' as const } } },
    orderBy: { order: 'asc' as const },
  },
} as const

// Full include for detail views (with storyBeats)
const PROJECT_FULL_INCLUDE = {
  characters: true,
  worldRules: true,
  volumes: {
    include: {
      stages: {
        include: {
          units: {
            include: {
              chapters: {
                include: { storyBeats: { orderBy: { order: 'asc' as const } } },
                orderBy: { order: 'asc' as const },
              },
            },
            orderBy: { order: 'asc' as const },
          },
        },
        orderBy: { order: 'asc' as const },
      },
    },
    orderBy: { order: 'asc' as const },
  },
  plotLines: {
    include: { plotPoints: { orderBy: { order: 'asc' as const } } },
    orderBy: { order: 'asc' as const },
  },
} as const

/**
 * Fetch a project with all nested relations (light version without storyBeats)
 * Use this for most operations to reduce memory usage
 */
export async function getProjectLight(id: string) {
  return db.novelProject.findUnique({
    where: { id },
    include: PROJECT_LIGHT_INCLUDE,
  })
}

/**
 * Fetch a project with all nested relations (full version with storyBeats)
 * Use this only when storyBeats are needed (e.g., writing space)
 */
export async function getProjectFull(id: string) {
  return db.novelProject.findUnique({
    where: { id },
    include: PROJECT_FULL_INCLUDE,
  })
}

/**
 * Fetch all projects with nested relations (light version)
 */
export async function getAllProjects() {
  return db.novelProject.findMany({
    include: PROJECT_LIGHT_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  })
}

export { PROJECT_LIGHT_INCLUDE, PROJECT_FULL_INCLUDE }
