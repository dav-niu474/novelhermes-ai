import { generateSparkExpansion } from '@/lib/ai'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/ai/spark - 灵感激发AI生成
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { spark, projectId } = body

    if (!spark || !spark.trim()) {
      return NextResponse.json({ error: '灵感关键词不能为空' }, { status: 400 })
    }

    const result = await generateSparkExpansion(spark)

    if (!result) {
      return NextResponse.json({ error: 'AI生成失败，请重试' }, { status: 500 })
    }

    if (projectId) {
      await db.novelProject.update({
        where: { id: projectId },
        data: {
          title: result.title || '未命名项目',
          synopsis: result.synopsis,
          goldenFinger: result.goldenFinger,
          worldBackground: result.worldBackground,
          tags: result.tags,
        },
      })

      if (result.characters && result.characters.length > 0) {
        await db.character.deleteMany({ where: { projectId } })
        for (const char of result.characters) {
          await db.character.create({
            data: {
              projectId,
              name: char.name,
              role: char.role || '主角',
              personality: char.personality,
              background: char.background,
              conflict: char.conflict,
            },
          })
        }
      }

      const finalProject = await db.novelProject.findUnique({
        where: { id: projectId },
        include: {
          characters: true,
          worldRules: true,
          chapters: { include: { storyBeats: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } },
        },
      })
      return NextResponse.json({ result, project: finalProject })
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Spark generation error:', error)
    return NextResponse.json({ error: 'AI生成失败' }, { status: 500 })
  }
}
