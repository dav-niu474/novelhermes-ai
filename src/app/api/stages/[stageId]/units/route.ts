import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/stages/[stageId]/units - List units for a stage (with chapters)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const { stageId } = await params
    const units = await db.unit.findMany({
      where: { stageId },
      include: {
        chapters: {
          include: { storyBeats: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(units)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 })
  }
}

// POST /api/stages/[stageId]/units - Create a unit under a stage
export async function POST(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const { stageId } = await params
    const body = await request.json()

    // Auto-assign order if not provided
    let order = body.order
    if (order === undefined) {
      const maxOrder = await db.unit.aggregate({
        where: { stageId },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? -1) + 1
    }

    const unit = await db.unit.create({
      data: {
        stageId,
        title: body.title || '未命名单元',
        summary: body.summary,
        chapterPlan: body.chapterPlan,
        order,
      },
      include: {
        chapters: {
          include: { storyBeats: true },
        },
      },
    })
    return NextResponse.json(unit)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 })
  }
}
