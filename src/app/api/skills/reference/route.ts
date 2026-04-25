import { NextResponse } from 'next/server'
import { getSkillReference } from '@/lib/skill-loader'

// GET /api/skills/reference?name=xxx - Get a specific reference document
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')

  if (!name) {
    return NextResponse.json({ error: 'name parameter is required' }, { status: 400 })
  }

  const content = await getSkillReference(name)
  if (!content) {
    return NextResponse.json({ error: `Reference "${name}" not found` }, { status: 404 })
  }

  return NextResponse.json({ name, content })
}
