import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/projects - 获取所有项目
export async function GET() {
  try {
    const projects = await db.novelProject.findMany({
      include: {
        characters: true,
        worldRules: true,
        chapters: {
          include: { storyBeats: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(projects)
  } catch (error) {
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
      include: {
        characters: true,
        worldRules: true,
        chapters: { include: { storyBeats: true } },
      },
    })
    return NextResponse.json(project)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
