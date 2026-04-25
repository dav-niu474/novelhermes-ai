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
      include: { characters: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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
      return NextResponse.json({ error: '大纲推演失败，请重试' }, { status: 500 })
    }

    await db.chapter.deleteMany({ where: { projectId } })

    for (let idx = 0; idx < result.chapters.length; idx++) {
      const ch = result.chapters[idx]
      const chapter = await db.chapter.create({
        data: {
          projectId,
          order: typeof ch.order === 'number' ? ch.order : idx + 1,
          title: ch.title || `第${idx + 1}章`,
          summary: ch.summary || '',
          content: '',
          status: 'draft',
        },
      })

      if (ch.beats && Array.isArray(ch.beats) && ch.beats.length > 0) {
        for (let i = 0; i < ch.beats.length; i++) {
          await db.storyBeat.create({
            data: {
              chapterId: chapter.id,
              type: ch.beats[i].type || 'opening',
              content: ch.beats[i].content || '',
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
    return NextResponse.json({ error: '大纲推演失败' }, { status: 500 })
  }
}
