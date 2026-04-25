import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/volumes/[volumeId]/stages - List stages for a volume
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ volumeId: string }> }
) {
  try {
    const { volumeId } = await params
    const stages = await db.stage.findMany({
      where: { volumeId },
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
    })
    return NextResponse.json(stages)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 })
  }
}

// POST /api/volumes/[volumeId]/stages - Create a stage under a volume
export async function POST(
  request: Request,
  { params }: { params: Promise<{ volumeId: string }> }
) {
  try {
    const { volumeId } = await params
    const body = await request.json()

    // Auto-assign order if not provided
    let order = body.order
    if (order === undefined) {
      const maxOrder = await db.stage.aggregate({
        where: { volumeId },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? -1) + 1
    }

    const stage = await db.stage.create({
      data: {
        volumeId,
        title: body.title || '未命名阶段',
        summary: body.summary,
        order,
      },
      include: {
        units: {
          include: {
            chapters: { include: { storyBeats: true } },
          },
        },
      },
    })
    return NextResponse.json(stage)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create stage' }, { status: 500 })
  }
}
