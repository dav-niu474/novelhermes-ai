import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT /api/volumes/[volumeId] - Update volume
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ volumeId: string }> }
) {
  try {
    const { volumeId } = await params
    const body = await request.json()
    const volume = await db.volume.update({
      where: { id: volumeId },
      data: {
        title: body.title,
        summary: body.summary,
        order: body.order,
      },
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
    })
    return NextResponse.json(volume)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update volume' }, { status: 500 })
  }
}

// DELETE /api/volumes/[volumeId] - Delete volume (cascade deletes stages, units, chapters)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ volumeId: string }> }
) {
  try {
    const { volumeId } = await params
    await db.volume.delete({ where: { id: volumeId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete volume' }, { status: 500 })
  }
}
