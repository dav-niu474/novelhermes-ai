import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT /api/world-rules/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const rule = await db.worldRule.update({
      where: { id },
      data: {
        category: body.category,
        title: body.title,
        content: body.content,
      },
    })
    return NextResponse.json(rule)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update world rule' }, { status: 500 })
  }
}

// DELETE /api/world-rules/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.worldRule.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete world rule' }, { status: 500 })
  }
}
