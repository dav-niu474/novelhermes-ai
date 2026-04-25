import { generateOutline } from '@/lib/ai'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/ai/outline - 因果律大纲推演
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const project = await db.novelProject.findUnique({
      where: { id: projectId },
      include: { characters: true, worldRules: true },
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // Validate minimum data for outline generation
    if (!project.title || project.title === '未命名项目') {
      return NextResponse.json({ error: '请先在灵感实验室生成或填写项目标题和设定' }, { status: 400 })
    }

    const result = await generateOutline({
      title: project.title,
      synopsis: project.synopsis,
      goldenFinger: project.goldenFinger,
      worldBackground: project.worldBackground,
      characters: project.characters.map((c) => ({
        name: c.name,
        role: c.role,
        personality: c.personality,
        background: c.background,
        conflict: c.conflict,
      })),
    })

    if (!result || !result.chapters) {
      return NextResponse.json({ error: '大纲推演失败，AI 返回格式异常，请重试' }, { status: 500 })
    }

    // Validate chapters structure
    const chapters = result.chapters as Record<string, unknown>[]
    if (!Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json({ error: '大纲推演失败：未生成有效章节，请重试' }, { status: 500 })
    }

    // Clear existing chapters
    await db.chapter.deleteMany({ where: { projectId } })

    for (let idx = 0; idx < chapters.length; idx++) {
      const ch = chapters[idx]
      const chapter = await db.chapter.create({
        data: {
          projectId,
          order: typeof ch.order === 'number' ? ch.order : idx + 1,
          title: String(ch.title || `第${idx + 1}章`),
          summary: String(ch.summary || ''),
          content: '',
          status: 'draft',
        },
      })

      const beats = ch.beats
      if (beats && Array.isArray(beats) && beats.length > 0) {
        for (let i = 0; i < beats.length; i++) {
          const beat = beats[i] as Record<string, unknown>
          await db.storyBeat.create({
            data: {
              chapterId: chapter.id,
              type: String(beat.type || 'opening'),
              content: String(beat.content || ''),
              order: i,
            },
          })
        }
      }
    }

    const updatedProject = await db.novelProject.findUnique({
      where: { id: projectId },
      include: {
        characters: true,
        worldRules: true,
        chapters: {
          include: { storyBeats: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json({ result, project: updatedProject })
  } catch (error) {
    console.error('Outline generation error:', error)
    const message = error instanceof Error ? error.message : '大纲推演失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
