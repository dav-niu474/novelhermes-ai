import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Full include for nested hierarchy
const PROJECT_INCLUDE = {
  characters: true,
  worldRules: true,
  volumes: {
    include: {
      stages: {
        include: {
          units: {
            include: {
              chapters: {
                include: { storyBeats: { orderBy: { order: 'asc' } } },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  },
  plotLines: {
    include: { plotPoints: { orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  },
}

// GET /api/projects - 获取所有项目
export async function GET() {
  try {
    const projects = await db.novelProject.findMany({
      include: PROJECT_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// POST /api/projects - 创建新项目
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const project = await db.novelProject.create({
      data: {
        spark: body.spark || '',
        title: body.title || '未命名项目',
        synopsis: body.synopsis,
        goldenFinger: body.goldenFinger,
        worldBackground: body.worldBackground,
        tags: body.tags,
      },
      include: PROJECT_INCLUDE,
    })
    return NextResponse.json(project)
  } catch (error) {
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
