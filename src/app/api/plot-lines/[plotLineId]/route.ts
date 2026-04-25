import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT /api/plot-lines/[plotLineId] - Update plot line
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ plotLineId: string }> }
) {
  try {
    const { plotLineId } = await params
    const body = await request.json()
    const plotLine = await db.plotLine.update({
      where: { id: plotLineId },
      data: {
        type: body.type,
        title: body.title,
        description: body.description,
        order: body.order,
        color: body.color,
      },
      include: {
        plotPoints: { orderBy: { order: 'asc' } },
      },
    })
    return NextResponse.json(plotLine)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update plot line' }, { status: 500 })
  }
}

// DELETE /api/plot-lines/[plotLineId] - Delete plot line (cascade deletes plot points)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ plotLineId: string }> }
) {
  try {
    const { plotLineId } = await params
    await db.plotLine.delete({ where: { id: plotLineId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete plot line' }, { status: 500 })
  }
}
