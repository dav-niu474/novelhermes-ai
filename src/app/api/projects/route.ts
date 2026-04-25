import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAllProjects, PROJECT_LIGHT_INCLUDE } from '@/lib/db-utils'

// GET /api/projects - 获取所有项目
export async function GET() {
  try {
    const projects = await getAllProjects()
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch projects'
    return NextResponse.json({ error: message }, { status: 500 })
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
      include: {
        characters: true,
        worldRules: true,
        volumes: {
          include: {
            stages: {
              include: {
                units: {
                  include: {
                    chapters: { orderBy: { order: 'asc' } },
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
      },
    })
    return NextResponse.json(project)
  } catch (error) {
    console.error('Failed to create project:', error)
    const message = error instanceof Error ? error.message : 'Failed to create project'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
