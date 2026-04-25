import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/units/[unitId]/chapters - List chapters for a unit
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params
    const chapters = await db.chapter.findMany({
      where: { unitId },
      include: { storyBeats: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(chapters)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 })
  }
}

// POST /api/units/[unitId]/chapters - Create a chapter under a unit
// Looks up projectId by traversing unit→stage→volume→project
export async function POST(
  request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params
    const body = await request.json()

    // Look up projectId by traversing unit → stage → volume → project
    const unit = await db.unit.findUnique({
      where: { id: unitId },
      include: {
        stage: {
          include: {
            volume: {
              select: { projectId: true },
            },
          },
        },
      },
    })

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    const projectId = unit.stage.volume.projectId

    // Auto-assign order if not provided
    let order = body.order
    if (order === undefined) {
      const maxOrder = await db.chapter.aggregate({
        where: { unitId },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? -1) + 1
    }

    const chapter = await db.chapter.create({
      data: {
        unitId,
        projectId,
        title: body.title || '未命名章节',
        summary: body.summary,
        content: body.content ?? '',
        plotPoints: body.plotPoints,
        wordCount: body.wordCount ?? 0,
        status: body.status || 'draft',
        order,
      },
      include: { storyBeats: { orderBy: { order: 'asc' } } },
    })
    return NextResponse.json(chapter)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create chapter' }, { status: 500 })
  }
}
