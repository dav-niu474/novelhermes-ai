import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/projects/[id]/chapters
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const maxOrder = await db.chapter.findFirst({
      where: { projectId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    const chapter = await db.chapter.create({
      data: {
        projectId: id,
        order: body.order ?? (maxOrder ? maxOrder.order + 1 : 0),
        title: body.title || '未命名章节',
        summary: body.summary,
        content: body.content || '',
        status: body.status || 'draft',
      },
      include: { storyBeats: true },
    })
    return NextResponse.json(chapter)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create chapter' }, { status: 500 })
  }
}
