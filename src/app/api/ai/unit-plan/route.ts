import { generateUnitChapterPlan } from '@/lib/ai'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/ai/unit-plan - 为指定单元生成章节规划
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { unitId, projectId } = body

    if (!unitId || !projectId) {
      return NextResponse.json({ error: 'unitId and projectId are required' }, { status: 400 })
    }

    // Get the unit with its parent chain
    const unit = await db.unit.findUnique({
      where: { id: unitId },
      include: {
        stage: {
          include: {
            volume: true,
          },
        },
      },
    })

    if (!unit) {
      return NextResponse.json({ error: '单元不存在' }, { status: 404 })
    }

    // Get the project with plot lines
    const project = await db.novelProject.findUnique({
      where: { id: projectId },
      include: {
        plotLines: {
          include: {
            plotPoints: { orderBy: { order: 'asc' } },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // Call AI to generate chapter plan
    const result = await generateUnitChapterPlan(
      { title: unit.title, summary: unit.summary },
      {
        title: project.title,
        synopsis: project.synopsis,
        goldenFinger: project.goldenFinger,
        worldBackground: project.worldBackground,
        plotLines: project.plotLines.map((pl) => ({
          type: pl.type,
          title: pl.title,
          plotPoints: pl.plotPoints.map((pp) => ({
            title: pp.title,
            description: pp.description,
          })),
        })),
      }
    )

    if (!result || !result.chapters) {
      return NextResponse.json({ error: '单元章节规划失败，AI 返回格式异常，请重试' }, { status: 500 })
    }

    const chapters = result.chapters as Record<string, unknown>[]
    if (!Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json({ error: '单元章节规划失败：未生成有效章节，请重试' }, { status: 500 })
    }

    // Clear existing chapters under this unit
    await db.chapter.deleteMany({ where: { unitId } })

    // Create new chapters with beats
    for (let ci = 0; ci < chapters.length; ci++) {
      const ch = chapters[ci]
      const chOrder = typeof ch.order === 'number' ? ch.order : ci + 1

      // Parse plotPoints as JSON string for storage
      const plotPointsArr = ch.plotPoints as string[] | undefined
      const plotPointsJson = plotPointsArr && Array.isArray(plotPointsArr)
        ? JSON.stringify(plotPointsArr)
        : null

      const chapter = await db.chapter.create({
        data: {
          unitId,
          projectId,
          order: chOrder,
          title: String(ch.title || `第${chOrder}章`),
          summary: String(ch.summary || ''),
          content: '',
          status: 'planned',
          plotPoints: plotPointsJson,
        },
      })

      // Create story beats
      const beats = ch.beats as Record<string, unknown>[] | undefined
      if (beats && Array.isArray(beats) && beats.length > 0) {
        for (let bi = 0; bi < beats.length; bi++) {
          const beat = beats[bi] as Record<string, unknown>
          await db.storyBeat.create({
            data: {
              chapterId: chapter.id,
              type: String(beat.type || 'opening'),
              content: String(beat.content || ''),
              order: bi,
            },
          })
        }
      }
    }

    // Return updated project with full nested data
    const updatedProject = await db.novelProject.findUnique({
      where: { id: projectId },
      include: {
        characters: true,
        worldRules: true,
        volumes: {
          orderBy: { order: 'asc' },
          include: {
            stages: {
              orderBy: { order: 'asc' },
              include: {
                units: {
                  orderBy: { order: 'asc' },
                  include: {
                    chapters: {
                      orderBy: { order: 'asc' },
                      include: { storyBeats: { orderBy: { order: 'asc' } } },
                    },
                  },
                },
              },
            },
          },
        },
        plotLines: {
          orderBy: { order: 'asc' },
          include: {
            plotPoints: { orderBy: { order: 'asc' } },
          },
        },
      },
    })

    return NextResponse.json({ result, project: updatedProject })
  } catch (error) {
    console.error('Unit plan generation error:', error)
    const message = error instanceof Error ? error.message : '单元章节规划失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
