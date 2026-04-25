import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/projects/[id]/volumes - List all volumes with nested stages→units→chapters
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const volumes = await db.volume.findMany({
      where: { projectId: id },
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
    })
    return NextResponse.json(volumes)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch volumes' }, { status: 500 })
  }
}

// POST /api/projects/[id]/volumes - Create a volume under a project
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Auto-assign order if not provided
    let order = body.order
    if (order === undefined) {
      const maxOrder = await db.volume.aggregate({
        where: { projectId: id },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? -1) + 1
    }

    const volume = await db.volume.create({
      data: {
        projectId: id,
        title: body.title || '未命名卷',
        summary: body.summary,
        order,
      },
      include: {
        stages: {
          include: {
            units: {
              include: { chapters: { include: { storyBeats: true } } },
            },
          },
        },
      },
    })
    return NextResponse.json(volume)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create volume' }, { status: 500 })
  }
}
