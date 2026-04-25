import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/plot-lines/[plotLineId]/plot-points - List plot points for a plot line
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ plotLineId: string }> }
) {
  try {
    const { plotLineId } = await params
    const plotPoints = await db.plotPoint.findMany({
      where: { plotLineId },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(plotPoints)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch plot points' }, { status: 500 })
  }
}

// POST /api/plot-lines/[plotLineId]/plot-points - Create a plot point under a plot line
export async function POST(
  request: Request,
  { params }: { params: Promise<{ plotLineId: string }> }
) {
  try {
    const { plotLineId } = await params
    const body = await request.json()

    // Auto-assign order if not provided
    let order = body.order
    if (order === undefined) {
      const maxOrder = await db.plotPoint.aggregate({
        where: { plotLineId },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? -1) + 1
    }

    const plotPoint = await db.plotPoint.create({
      data: {
        plotLineId,
        targetLevel: body.targetLevel || 'unit',
        targetId: body.targetId || '',
        title: body.title || '未命名剧情点',
        description: body.description,
        status: body.status || 'planned',
        order,
      },
    })
    return NextResponse.json(plotPoint)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create plot point' }, { status: 500 })
  }
}
