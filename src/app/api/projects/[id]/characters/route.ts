import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/projects/[id]/characters
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const character = await db.character.create({
      data: {
        projectId: id,
        name: body.name,
        role: body.role || '主角',
        personality: body.personality,
        background: body.background,
        conflict: body.conflict,
      },
    })
    return NextResponse.json(character)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create character' }, { status: 500 })
  }
}
