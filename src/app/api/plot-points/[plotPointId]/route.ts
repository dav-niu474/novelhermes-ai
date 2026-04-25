import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT /api/plot-points/[plotPointId] - Update plot point
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ plotPointId: string }> }
) {
  try {
    const { plotPointId } = await params
    const body = await request.json()
    const plotPoint = await db.plotPoint.update({
      where: { id: plotPointId },
      data: {
        targetLevel: body.targetLevel,
        targetId: body.targetId,
        title: body.title,
        description: body.description,
        status: body.status,
        order: body.order,
      },
    })
    return NextResponse.json(plotPoint)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update plot point' }, { status: 500 })
  }
}

// DELETE /api/plot-points/[plotPointId] - Delete plot point
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ plotPointId: string }> }
) {
  try {
    const { plotPointId } = await params
    await db.plotPoint.delete({ where: { id: plotPointId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete plot point' }, { status: 500 })
  }
}
