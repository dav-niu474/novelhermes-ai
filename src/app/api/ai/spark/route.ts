import { generateSparkExpansion } from '@/lib/ai'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Allow up to 60 seconds for AI generation on Vercel
export const maxDuration = 60

// POST /api/ai/spark - 灵感激发AI生成
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { spark, projectId } = body

    if (!spark || !spark.trim()) {
      return NextResponse.json({ error: '灵感关键词不能为空' }, { status: 400 })
    }

    console.log('[Spark] Starting generation for:', spark.slice(0, 50))
    const result = await generateSparkExpansion(spark)
    console.log('[Spark] Generation complete, title:', result?.title)

    if (!result) {
      return NextResponse.json({ error: 'AI生成失败，请重试' }, { status: 500 })
    }

    if (projectId) {
      console.log('[Spark] Saving to project:', projectId)
      try {
        await db.novelProject.update({
          where: { id: projectId },
          data: {
            spark,
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
        console.log('[Spark] Save complete')
      } catch (dbError) {
        console.error('[Spark] DB save error:', dbError)
        // Return the AI result even if DB save fails
        return NextResponse.json({ result, dbError: '保存到数据库失败，但AI生成结果已返回' })
      }
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Spark generation error:', error)
    const message = error instanceof Error ? error.message : 'AI生成失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
