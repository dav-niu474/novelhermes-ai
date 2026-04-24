import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/projects/[id]/world-rules
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const rule = await db.worldRule.create({
      data: {
        projectId: id,
        category: body.category || '基础规则',
        title: body.title,
        content: body.content,
      },
    })
    return NextResponse.json(rule)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create world rule' }, { status: 500 })
  }
}
