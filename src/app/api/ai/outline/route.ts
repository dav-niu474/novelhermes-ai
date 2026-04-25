import { generateHierarchicalOutline } from '@/lib/ai'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/ai/outline - 层级大纲推演 (卷→阶段→单元→章 + 剧情线)
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

    const result = await generateHierarchicalOutline({
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

    if (!result || !result.volumes) {
      return NextResponse.json({ error: '大纲推演失败，AI 返回格式异常，请重试' }, { status: 500 })
    }

    const volumes = result.volumes as Record<string, unknown>[]
    const plotLines = result.plotLines as Record<string, unknown>[] | undefined

    if (!Array.isArray(volumes) || volumes.length === 0) {
      return NextResponse.json({ error: '大纲推演失败：未生成有效卷结构，请重试' }, { status: 500 })
    }

    // ─── Clear existing data (cascade deletes handle children) ───
    await db.plotLine.deleteMany({ where: { projectId } })
    await db.volume.deleteMany({ where: { projectId } })

    // ─── Build ID lookup maps for resolving targetOrder → actual IDs ───
    // We track created entities by their order to resolve plotPoint targetOrder references
    const volumeIdMap = new Map<number, string>() // order → id
    const stageIdMap = new Map<string, string>()  // "volumeOrder-stageOrder" → id
    const unitIdMap = new Map<string, string>()    // "volumeOrder-stageOrder-unitOrder" → id
    const chapterIdMap = new Map<string, string>() // "volumeOrder-stageOrder-unitOrder-chapterOrder" → id

    // ─── Create the full hierarchy ───
    for (let vi = 0; vi < volumes.length; vi++) {
      const vol = volumes[vi]
      const volOrder = typeof vol.order === 'number' ? vol.order : vi + 1

      const volume = await db.volume.create({
        data: {
          projectId,
          order: volOrder,
          title: String(vol.title || `第${volOrder}卷`),
          summary: String(vol.summary || ''),
        },
      })
      volumeIdMap.set(volOrder, volume.id)

      const stages = vol.stages as Record<string, unknown>[] | undefined
      if (!stages || !Array.isArray(stages)) continue

      for (let si = 0; si < stages.length; si++) {
        const stg = stages[si]
        const stgOrder = typeof stg.order === 'number' ? stg.order : si + 1

        const stage = await db.stage.create({
          data: {
            volumeId: volume.id,
            order: stgOrder,
            title: String(stg.title || `阶段${stgOrder}`),
            summary: String(stg.summary || ''),
          },
        })
        stageIdMap.set(`${volOrder}-${stgOrder}`, stage.id)

        const units = stg.units as Record<string, unknown>[] | undefined
        if (!units || !Array.isArray(units)) continue

        for (let ui = 0; ui < units.length; ui++) {
          const unt = units[ui]
          const untOrder = typeof unt.order === 'number' ? unt.order : ui + 1

          const unit = await db.unit.create({
            data: {
              stageId: stage.id,
              order: untOrder,
              title: String(unt.title || `单元${untOrder}`),
              summary: String(unt.summary || ''),
              chapterPlan: unt.chapterPlan ? String(unt.chapterPlan) : null,
            },
          })
          unitIdMap.set(`${volOrder}-${stgOrder}-${untOrder}`, unit.id)

          const chapters = unt.chapters as Record<string, unknown>[] | undefined
          if (!chapters || !Array.isArray(chapters)) continue

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
                unitId: unit.id,
                projectId,
                order: chOrder,
                title: String(ch.title || `第${chOrder}章`),
                summary: String(ch.summary || ''),
                content: '',
                status: 'planned',
                plotPoints: plotPointsJson,
              },
            })
            chapterIdMap.set(`${volOrder}-${stgOrder}-${untOrder}-${chOrder}`, chapter.id)

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
        }
      }
    }

    // ─── Create plot lines and plot points ───
    if (plotLines && Array.isArray(plotLines)) {
      for (let pli = 0; pli < plotLines.length; pli++) {
        const pl = plotLines[pli]
        const plotLine = await db.plotLine.create({
          data: {
            projectId,
            type: String(pl.type || 'main'),
            title: String(pl.title || `剧情线${pli + 1}`),
            description: pl.description ? String(pl.description) : null,
            color: pl.color ? String(pl.color) : (pl.type === 'main' ? '#10b981' : '#f59e0b'),
            order: pli,
          },
        })

        const ppArr = pl.plotPoints as Record<string, unknown>[] | undefined
        if (ppArr && Array.isArray(ppArr)) {
          for (let ppi = 0; ppi < ppArr.length; ppi++) {
            const pp = ppArr[ppi]
            const targetLevel = String(pp.targetLevel || 'unit')
            const targetOrder = typeof pp.targetOrder === 'number' ? pp.targetOrder : 1

            // Resolve targetOrder to actual entity ID
            let targetId = ''
            switch (targetLevel) {
              case 'volume':
                targetId = volumeIdMap.get(targetOrder) || ''
                break
              case 'stage': {
                // For stage-level, targetOrder refers to the global stage index
                // Find the stage by iterating through the stageIdMap
                const stageEntry = Array.from(stageIdMap.entries())
                  .find(([key]) => {
                    const parts = key.split('-')
                    return parseInt(parts[1]) === targetOrder
                  })
                targetId = stageEntry?.[1] || ''
                break
              }
              case 'unit': {
                // For unit-level, targetOrder refers to the global unit index
                const unitEntry = Array.from(unitIdMap.entries())
                  .find(([key]) => {
                    const parts = key.split('-')
                    return parseInt(parts[2]) === targetOrder
                  })
                targetId = unitEntry?.[1] || ''
                break
              }
              case 'chapter': {
                // For chapter-level, targetOrder refers to the global chapter index
                const chapterEntry = Array.from(chapterIdMap.entries())
                  .find(([key]) => {
                    const parts = key.split('-')
                    return parseInt(parts[3]) === targetOrder
                  })
                targetId = chapterEntry?.[1] || ''
                break
              }
            }

            // If we couldn't resolve the target, try a fallback: use the first entity of that level
            if (!targetId) {
              if (targetLevel === 'volume' && volumeIdMap.size > 0) {
                targetId = Array.from(volumeIdMap.values())[0]
              } else if (targetLevel === 'stage' && stageIdMap.size > 0) {
                targetId = Array.from(stageIdMap.values())[0]
              } else if (targetLevel === 'unit' && unitIdMap.size > 0) {
                targetId = Array.from(unitIdMap.values())[0]
              } else if (targetLevel === 'chapter' && chapterIdMap.size > 0) {
                targetId = Array.from(chapterIdMap.values())[0]
              }
            }

            await db.plotPoint.create({
              data: {
                plotLineId: plotLine.id,
                targetLevel,
                targetId: targetId || 'unresolved',
                order: ppi,
                title: String(pp.title || `剧情点${ppi + 1}`),
                description: pp.description ? String(pp.description) : null,
                status: 'planned',
              },
            })
          }
        }
      }
    }

    // ─── Return updated project with full nested data ───
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
    console.error('Outline generation error:', error)
    const message = error instanceof Error ? error.message : '大纲推演失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
