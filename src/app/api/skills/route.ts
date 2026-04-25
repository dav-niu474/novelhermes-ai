import { NextResponse } from 'next/server'
import { listSkills, loadWangwenSkill, updateWangwenSkill } from '@/lib/skill-loader'

// GET /api/skills - List all loaded skills
export async function GET() {
  try {
    const skills = await listSkills()
    const wangwen = await loadWangwenSkill()

    return NextResponse.json({
      skills,
      wangwenCreative: wangwen ? {
        name: wangwen.meta.name,
        description: wangwen.meta.description.slice(0, 200),
        version: wangwen.meta.version,
        lastUpdated: wangwen.meta.lastUpdated,
        referencesCount: Object.keys(wangwen.references).length,
        genreTemplatesCount: Object.keys(wangwen.genreTemplates).length,
        references: Object.keys(wangwen.references),
        genreTemplates: Object.keys(wangwen.genreTemplates),
      } : null,
    })
  } catch (error) {
    console.error('Failed to list skills:', error)
    return NextResponse.json({ error: 'Failed to list skills' }, { status: 500 })
  }
}

// POST /api/skills - Update skills from remote
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action } = body

    if (action === 'update_wangwen') {
      const result = await updateWangwenSkill()
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Failed to update skills:', error)
    return NextResponse.json({ error: 'Failed to update skills' }, { status: 500 })
  }
}
