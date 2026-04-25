import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT /api/chapters/[id] - Update chapter
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const chapter = await db.chapter.update({
      where: { id },
      data: {
        title: body.title,
        summary: body.summary,
        content: body.content,
        plotPoints: body.plotPoints,
        wordCount: body.wordCount,
        status: body.status,
        order: body.order,
      },
      include: { storyBeats: { orderBy: { order: 'asc' } } },
    })
    return NextResponse.json(chapter)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update chapter' }, { status: 500 })
  }
}

// DELETE /api/chapters/[id] - Delete chapter
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.chapter.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete chapter' }, { status: 500 })
  }
}
