import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getProjectLight, getProjectFull } from '@/lib/db-utils'

// GET /api/projects/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Check if full include is requested via query param
    const url = new URL(request.url)
    const full = url.searchParams.get('full') === 'true'
    
    const project = full ? await getProjectFull(id) : await getProjectLight(id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    return NextResponse.json(project)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch project'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/projects/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    await db.novelProject.update({
      where: { id },
      data: {
        spark: body.spark,
        title: body.title,
        synopsis: body.synopsis,
        goldenFinger: body.goldenFinger,
        worldBackground: body.worldBackground,
        tags: body.tags,
      },
    })
    // Fetch separately with light include to reduce memory
    const project = await getProjectLight(id)
    return NextResponse.json(project)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update project'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/projects/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.novelProject.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete project'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
