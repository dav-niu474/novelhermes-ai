import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/projects/[id]/plot-lines - List all plot lines for a project (with plotPoints)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const plotLines = await db.plotLine.findMany({
      where: { projectId: id },
      include: {
        plotPoints: { orderBy: { order: 'asc' } },
      },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(plotLines)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch plot lines' }, { status: 500 })
  }
}

// POST /api/projects/[id]/plot-lines - Create a plot line under a project
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
      const maxOrder = await db.plotLine.aggregate({
        where: { projectId: id },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? -1) + 1
    }

    const plotLine = await db.plotLine.create({
      data: {
        projectId: id,
        type: body.type || 'main',
        title: body.title || '未命名剧情线',
        description: body.description,
        order,
        color: body.color,
      },
      include: {
        plotPoints: { orderBy: { order: 'asc' } },
      },
    })
    return NextResponse.json(plotLine)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create plot line' }, { status: 500 })
  }
}
