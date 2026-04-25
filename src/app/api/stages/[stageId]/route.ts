import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT /api/stages/[stageId] - Update stage
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const { stageId } = await params
    const body = await request.json()
    const stage = await db.stage.update({
      where: { id: stageId },
      data: {
        title: body.title,
        summary: body.summary,
        order: body.order,
      },
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
    })
    return NextResponse.json(stage)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
  }
}

// DELETE /api/stages/[stageId] - Delete stage (cascade deletes units, chapters)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const { stageId } = await params
    await db.stage.delete({ where: { id: stageId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete stage' }, { status: 500 })
  }
}
