import { generateBeats } from '@/lib/ai'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/ai/beats - 章节戏剧节拍生成
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { chapterId, projectId } = body

    if (!chapterId || !projectId) {
      return NextResponse.json({ error: 'chapterId and projectId are required' }, { status: 400 })
    }

    const chapter = await db.chapter.findUnique({ where: { id: chapterId } })
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    const project = await db.novelProject.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const result = await generateBeats(
      { title: chapter.title, summary: chapter.summary },
      { title: project.title, goldenFinger: project.goldenFinger, worldBackground: project.worldBackground }
    )

    if (!result || !result.beats) {
      return NextResponse.json({ error: '节拍生成失败，AI 返回格式异常，请重试' }, { status: 500 })
    }

    const beats = result.beats as { type: string; content: string }[]
    if (!Array.isArray(beats) || beats.length === 0) {
      return NextResponse.json({ error: '节拍生成失败：未生成有效节拍，请重试' }, { status: 500 })
    }

    await db.storyBeat.deleteMany({ where: { chapterId } })

    for (let i = 0; i < beats.length; i++) {
      await db.storyBeat.create({
        data: {
          chapterId,
          type: beats[i].type || 'opening',
          content: beats[i].content || '',
          order: i,
        },
      })
    }

    const updatedChapter = await db.chapter.findUnique({
      where: { id: chapterId },
      include: { storyBeats: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ result, chapter: updatedChapter })
  } catch (error) {
    console.error('Beats generation error:', error)
    return NextResponse.json({ error: '节拍生成失败' }, { status: 500 })
  }
}
