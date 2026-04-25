import { NextResponse } from 'next/server'
import { getGenreTemplate } from '@/lib/skill-loader'

// GET /api/skills/genre-template?name=xxx - Get a specific genre template
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')

  if (!name) {
    return NextResponse.json({ error: 'name parameter is required' }, { status: 400 })
  }

  const content = await getGenreTemplate(name)
  if (!content) {
    return NextResponse.json({ error: `Genre template "${name}" not found` }, { status: 404 })
  }

  return NextResponse.json({ name, content })
}
