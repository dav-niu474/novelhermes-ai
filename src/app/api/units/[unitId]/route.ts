import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT /api/units/[unitId] - Update unit
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params
    const body = await request.json()
    const unit = await db.unit.update({
      where: { id: unitId },
      data: {
        title: body.title,
        summary: body.summary,
        chapterPlan: body.chapterPlan,
        order: body.order,
      },
      include: {
        chapters: {
          include: { storyBeats: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    })
    return NextResponse.json(unit)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 })
  }
}

// DELETE /api/units/[unitId] - Delete unit (cascade deletes chapters)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params
    await db.unit.delete({ where: { id: unitId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 })
  }
}
