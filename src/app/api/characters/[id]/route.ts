import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT /api/characters/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const character = await db.character.update({
      where: { id },
      data: {
        name: body.name,
        role: body.role,
        personality: body.personality,
        background: body.background,
        conflict: body.conflict,
      },
    })
    return NextResponse.json(character)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update character' }, { status: 500 })
  }
}

// DELETE /api/characters/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.character.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete character' }, { status: 500 })
  }
}
