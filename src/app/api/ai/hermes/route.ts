import { db } from '@/lib/db'
import { generateSparkExpansion, generateHierarchicalOutline } from '@/lib/ai'
import { chat } from '@/lib/nvidia-ai'
import { buildSkillContextForHermes, getSkillReference, getGenreTemplate } from '@/lib/skill-loader'
import { NextResponse } from 'next/server'

// ─── Tool Definitions ────────────────────────────────────────────────────────

interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  label: string
}

const TOOLS = [
  {
    name: 'generate_spark',
    description: '从灵感关键词生成完整的小说设定（书名、简介、金手指、世界观、角色）。需要用户提供的灵感关键词。',
    params: ['spark'],
  },
  {
    name: 'generate_outline',
    description: '基于当前项目设定，AI推演层级大纲（卷→阶段→单元→章 + 剧情线）。无需额外参数，使用项目已有的设定数据。',
    params: [],
  },
  {
    name: 'add_character',
    description: '为项目添加新角色。需要角色名称、角色类型(主角/反派/配角)、性格、背景、冲突。',
    params: ['name', 'role', 'personality', 'background', 'conflict'],
  },
  {
    name: 'add_world_rule',
    description: '为项目添加世界规则锚点。需要规则分类、标题、内容。',
    params: ['category', 'title', 'content'],
  },
  {
    name: 'write_chapter_draft',
    description: '为指定章节AI生成草稿正文。需要章节序号(order)。',
    params: ['chapterOrder'],
  },
  {
    name: 'navigate_to',
    description: '引导用户跳转到指定的工作区。可选值: spark(灵感实验室), architecture(架构看板), outline(大纲推演), writing(创作空间)。',
    params: ['tab'],
  },
  {
    name: 'analyze_project_state',
    description: '分析当前项目的创作进度和状态，返回缺失项和建议下一步。无需额外参数。',
    params: [],
  },
  {
    name: 'validate_readiness',
    description: '验证项目是否准备好进入下一个创作阶段。参数：target_stage(目标阶段)，可选值：spark, architecture, outline, writing。',
    params: ['target_stage'],
  },
  {
    name: 'suggest_next_step',
    description: '根据当前项目状态，建议用户下一步应该做什么。返回建议操作和导航目标。无需额外参数。',
    params: [],
  },
  {
    name: 'search_novel',
    description: '在番茄小说平台搜索小说。需要搜索关键词(书名/作者/关键词)。返回搜索结果列表。用于拆文分析前的原文获取。',
    params: ['query'],
  },
  {
    name: 'deconstruct_novel',
    description: '对指定作品进行六维度拆文分析（结构/角色/设定/节奏/文笔/商业）。需要书名和分析维度(可选: structure/character/setting/rhythm/writing/commerce，默认全维度)。返回拆文分析报告。',
    params: ['novelName', 'dimensions'],
  },
  {
    name: 'generate_genre_outline',
    description: '基于网文创作技能的类型模板，为指定类型生成定制化大纲。需要类型名称(如: xianxia/urban-rebirth/system-flow/infinite-flow/suspense/apocalypse/scifi-future/history-time-travel/game-esports/cultivation)。比通用大纲更专业，融合类型特色和创作方法论。',
    params: ['genre'],
  },
  {
    name: 'design_golden_finger',
    description: '为项目设计3个差异化的金手指方案。基于项目类型和已有设定，生成从经典到新颖递进的变体方案。每个方案含核心能力、激活条件、限制机制、成长路径。无需额外参数，使用项目已有设定。',
    params: [],
  },
  {
    name: 'creative_consultation',
    description: '创作方向顾问模式。当用户需求模糊（不知道写什么类型/方向）时触发，推荐3个差异化创作方向，每个含类型名、核心卖点、金手指方向、体验关键词。',
    params: [],
  },
] as const

// ─── Shared Project Include & Helpers ────────────────────────────────────────

const PROJECT_INCLUDE = {
  characters: true,
  worldRules: true,
  volumes: {
    include: {
      stages: {
        include: {
          units: {
            include: {
              chapters: {
                include: { storyBeats: { orderBy: { order: 'asc' } } },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  },
  plotLines: {
    include: { plotPoints: { orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  },
}

function flattenChapters(project: { volumes: { stages: { units: { chapters: { order: number; title: string; summary: string | null; content: string | null; wordCount: number; status: string; plotPoints: string | null; storyBeats: { type: string; content: string }[] }[] }[] }[] }[] }): { order: number; title: string; summary: string | null; content: string | null; wordCount: number; status: string; plotPoints: string | null; storyBeats: { type: string; content: string }[] }[] {
  return project.volumes.flatMap(v =>
    v.stages.flatMap(s =>
      s.units.flatMap(u => u.chapters)
    )
  )
}

// ─── Workflow Stage Analysis ──────────────────────────────────────────────────

function analyzeWorkflowStage(project: {
  title: string
  spark: string
  synopsis: string | null
  goldenFinger: string | null
  worldBackground: string | null
  tags: string | null
  characters: { name: string; role: string }[]
  worldRules: { category: string; title: string }[]
  chapters: { order: number; title: string; content: string | null; wordCount: number; status: string; storyBeats: { type: string; content: string }[] }[]
}): {
  stage: 'spark' | 'architecture' | 'outline' | 'writing'
  stageLabel: string
  progress: number
  missing: string[]
  suggestions: string[]
  nextAction: string
  navigateTo: string
} {
  // Stage 1: Spark - has basic settings?
  const hasSpark = !!(project.title && project.title !== '未命名项目' && project.spark)
  const hasBasicSettings = !!(project.synopsis && project.goldenFinger && project.worldBackground)

  // Stage 2: Architecture - has characters and world rules?
  const hasCharacters = project.characters.length > 0
  const hasWorldRules = project.worldRules.length > 0

  // Stage 3: Outline - has chapters?
  const hasOutline = project.chapters.length > 0

  // Stage 4: Writing - has content?
  const hasWriting = project.chapters.some(c => c.content && c.content.trim().length > 100)

  const missing: string[] = []
  const suggestions: string[] = []

  if (!hasSpark) {
    return {
      stage: 'spark',
      stageLabel: '灵感实验室',
      progress: 0,
      missing: ['灵感关键词', '项目标题'],
      suggestions: ['在灵感实验室输入灵感关键词，让 AI 生成小说设定', '或者直接描述你想写的小说类型和核心概念'],
      nextAction: 'generate_spark',
      navigateTo: 'spark',
    }
  }

  if (!hasBasicSettings) {
    if (!project.synopsis) missing.push('一句话简介')
    if (!project.goldenFinger) missing.push('金手指设定')
    if (!project.worldBackground) missing.push('世界观背景')
    suggestions.push('在架构看板中完善缺失的设定项')
    return {
      stage: 'architecture',
      stageLabel: '架构看板',
      progress: 25,
      missing,
      suggestions,
      nextAction: 'navigate_to',
      navigateTo: 'architecture',
    }
  }

  if (!hasCharacters || !hasWorldRules) {
    if (!hasCharacters) missing.push('角色设定')
    if (!hasWorldRules) missing.push('世界规则锚点')
    suggestions.push(hasCharacters ? '添加世界规则锚点，确保世界观一致性' : '创建核心角色，建立冲突关系')
    return {
      stage: 'architecture',
      stageLabel: '架构看板',
      progress: 50,
      missing,
      suggestions,
      nextAction: hasCharacters ? 'add_world_rule' : 'add_character',
      navigateTo: 'architecture',
    }
  }

  if (!hasOutline) {
    return {
      stage: 'outline',
      stageLabel: '大纲推演',
      progress: 60,
      missing: ['章节大纲'],
      suggestions: ['架构设定已完善，现在可以推演大纲了！', 'AI 将根据设定生成因果递进的层级大纲'],
      nextAction: 'generate_outline',
      navigateTo: 'outline',
    }
  }

  if (!hasWriting) {
    return {
      stage: 'writing',
      stageLabel: '创作空间',
      progress: 75,
      missing: ['章节正文'],
      suggestions: ['大纲已就绪，选择一个章节开始创作！', '也可以让 AI 为第一章生成草稿'],
      nextAction: 'write_chapter_draft',
      navigateTo: 'writing',
    }
  }

  // Advanced writing stage
  const completedChapters = project.chapters.filter(c => c.status === 'completed').length
  const totalChapters = project.chapters.length
  return {
    stage: 'writing',
    stageLabel: '创作空间',
    progress: Math.min(95, 75 + Math.round((completedChapters / totalChapters) * 20)),
    missing: [],
    suggestions: [
      `已完成 ${completedChapters}/${totalChapters} 章`,
      '继续创作或让 AI 辅助生成下一章草稿',
      '可以检查前后章节的一致性',
    ],
    nextAction: 'write_chapter_draft',
    navigateTo: 'writing',
  }
}

// ─── Tool Executors ──────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  projectId: string
): Promise<ToolResult> {
  try {
    switch (toolName) {
      // ── 灵感激发 ──
      case 'generate_spark': {
        const spark = String(args.spark || '')
        if (!spark.trim()) {
          return { success: false, error: '灵感关键词不能为空', label: '灵感生成失败' }
        }
        const result = await generateSparkExpansion(spark)
        if (!result) {
          return { success: false, error: 'AI生成失败', label: '灵感生成失败' }
        }
        await db.novelProject.update({
          where: { id: projectId },
          data: {
            spark,
            title: (result.title as string) || '未命名项目',
            synopsis: (result.synopsis as string) || null,
            goldenFinger: (result.goldenFinger as string) || null,
            worldBackground: (result.worldBackground as string) || null,
            tags: (result.tags as string) || null,
          },
        })
        if (result.characters && Array.isArray(result.characters)) {
          await db.character.deleteMany({ where: { projectId } })
          for (const char of result.characters as { name: string; role: string; personality?: string; background?: string; conflict?: string }[]) {
            await db.character.create({
              data: {
                projectId,
                name: char.name,
                role: char.role || '主角',
                personality: char.personality || null,
                background: char.background || null,
                conflict: char.conflict || null,
              },
            })
          }
        }
        const updated = await db.novelProject.findUnique({
          where: { id: projectId },
          include: PROJECT_INCLUDE,
        })
        return { success: true, data: updated, label: '灵感设定已生成' }
      }

      // ── 大纲推演（层级结构） ──
      case 'generate_outline': {
        const project = await db.novelProject.findUnique({
          where: { id: projectId },
          include: { characters: true },
        })
        if (!project) {
          return { success: false, error: '项目不存在', label: '大纲推演失败' }
        }
        if (!project.title || project.title === '未命名项目') {
          return { success: false, error: '请先在灵感实验室生成或填写项目设定', label: '大纲推演失败' }
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
          return { success: false, error: '大纲推演失败，AI 返回格式异常', label: '大纲推演失败' }
        }

        const volumes = result.volumes as Record<string, unknown>[]
        const plotLines = result.plotLines as Record<string, unknown>[] | undefined

        if (!Array.isArray(volumes) || volumes.length === 0) {
          return { success: false, error: '大纲推演失败：未生成有效卷结构', label: '大纲推演失败' }
        }

        // Clear existing data (cascade deletes handle children)
        await db.plotLine.deleteMany({ where: { projectId } })
        await db.volume.deleteMany({ where: { projectId } })

        // Build ID lookup maps for resolving targetOrder → actual IDs
        const volumeIdMap = new Map<number, string>()
        const stageIdMap = new Map<string, string>()
        const unitIdMap = new Map<string, string>()
        const chapterIdMap = new Map<string, string>()

        // Create the full hierarchy
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

        // Create plot lines and plot points
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

                let targetId = ''
                switch (targetLevel) {
                  case 'volume':
                    targetId = volumeIdMap.get(targetOrder) || ''
                    break
                  case 'stage': {
                    const stageEntry = Array.from(stageIdMap.entries())
                      .find(([key]) => {
                        const parts = key.split('-')
                        return parseInt(parts[1]) === targetOrder
                      })
                    targetId = stageEntry?.[1] || ''
                    break
                  }
                  case 'unit': {
                    const unitEntry = Array.from(unitIdMap.entries())
                      .find(([key]) => {
                        const parts = key.split('-')
                        return parseInt(parts[2]) === targetOrder
                      })
                    targetId = unitEntry?.[1] || ''
                    break
                  }
                  case 'chapter': {
                    const chapterEntry = Array.from(chapterIdMap.entries())
                      .find(([key]) => {
                        const parts = key.split('-')
                        return parseInt(parts[3]) === targetOrder
                      })
                    targetId = chapterEntry?.[1] || ''
                    break
                  }
                }

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

        const updated = await db.novelProject.findUnique({
          where: { id: projectId },
          include: PROJECT_INCLUDE,
        })
        return { success: true, data: updated, label: '层级大纲已推演完成' }
      }

      // ── 添加角色 ──
      case 'add_character': {
        const name = String(args.name || '')
        if (!name.trim()) {
          return { success: false, error: '角色名称不能为空', label: '添加角色失败' }
        }
        await db.character.create({
          data: {
            projectId,
            name,
            role: String(args.role || '配角'),
            personality: args.personality ? String(args.personality) : null,
            background: args.background ? String(args.background) : null,
            conflict: args.conflict ? String(args.conflict) : null,
          },
        })
        const updated = await db.novelProject.findUnique({
          where: { id: projectId },
          include: PROJECT_INCLUDE,
        })
        return { success: true, data: updated, label: `角色「${name}」已添加` }
      }

      // ── 添加世界规则 ──
      case 'add_world_rule': {
        const title = String(args.title || '')
        const content = String(args.content || '')
        if (!title.trim() || !content.trim()) {
          return { success: false, error: '标题和内容不能为空', label: '添加规则失败' }
        }
        await db.worldRule.create({
          data: {
            projectId,
            category: String(args.category || '基础规则'),
            title,
            content,
          },
        })
        const updated = await db.novelProject.findUnique({
          where: { id: projectId },
          include: PROJECT_INCLUDE,
        })
        return { success: true, data: updated, label: `规则「${title}」已添加` }
      }

      // ── 章节草稿生成 ──
      case 'write_chapter_draft': {
        const chapterOrder = Number(args.chapterOrder)
        if (!chapterOrder || chapterOrder < 1) {
          return { success: false, error: '章节序号无效', label: '草稿生成失败' }
        }
        const chapter = await db.chapter.findFirst({
          where: { projectId, order: chapterOrder },
          include: { storyBeats: { orderBy: { order: 'asc' } } },
        })
        if (!chapter) {
          return { success: false, error: `第${chapterOrder}章不存在，请先推演大纲`, label: '草稿生成失败' }
        }
        const project = await db.novelProject.findUnique({
          where: { id: projectId },
          include: { characters: true, worldRules: true },
        })
        if (!project) {
          return { success: false, error: '项目不存在', label: '草稿生成失败' }
        }

        const beatsInfo = chapter.storyBeats
          .map((b) => `  - ${b.type}: ${b.content}`)
          .join('\n')
        const charsInfo = project.characters
          .map((c) => `${c.name}(${c.role})`)
          .join('、')
        const rulesInfo = project.worldRules
          .map((r) => `[${r.category}] ${r.title}: ${r.content}`)
          .join('\n')

        const draft = await chat([
          {
            role: 'system',
            content: `你是一位专业的网文写手，擅长根据大纲和节拍写出精彩的章节正文。请根据给定的章节信息，写出该章的正文草稿。
要求：
- 正文字数800-1500字
- 严格遵循节拍（开场→冲突→转折→悬念）的节奏
- 对话要生动有个性
- 结尾要留悬念
- 直接输出正文，不要输出标题或其他元信息`,
          },
          {
            role: 'user',
            content: `小说：${project.title}
简介：${project.synopsis || '暂无'}
金手指：${project.goldenFinger || '暂无'}
世界观：${project.worldBackground || '暂无'}
角色：${charsInfo || '暂无'}
世界规则：${rulesInfo || '暂无'}

第${chapter.order}章「${chapter.title}」
摘要：${chapter.summary || '暂无'}
节拍：
${beatsInfo || '暂无'}`,
          },
        ], { temperature: 0.8, max_tokens: 4096 })
        if (!draft.trim()) {
          return { success: false, error: 'AI生成失败', label: '草稿生成失败' }
        }

        const chineseChars = (draft.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
        const englishWords = draft
          .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 0).length
        const wordCount = chineseChars + englishWords

        await db.chapter.update({
          where: { id: chapter.id },
          data: { content: draft, wordCount },
        })

        const updated = await db.novelProject.findUnique({
          where: { id: projectId },
          include: PROJECT_INCLUDE,
        })
        return { success: true, data: { project: updated, chapterOrder }, label: `第${chapterOrder}章草稿已生成(${wordCount}字)` }
      }

      // ── 导航 ──
      case 'navigate_to': {
        const tab = String(args.tab || '')
        const validTabs = ['spark', 'architecture', 'outline', 'writing']
        if (!validTabs.includes(tab)) {
          return { success: false, error: `无效的导航目标: ${tab}`, label: '导航失败' }
        }
        const tabLabels: Record<string, string> = { spark: '灵感实验室', architecture: '架构看板', outline: '大纲推演', writing: '创作空间' }
        return { success: true, data: { navigateTo: tab }, label: `已导航到${tabLabels[tab]}` }
      }

      // ── 项目状态分析 ──
      case 'analyze_project_state': {
        const project = await db.novelProject.findUnique({
          where: { id: projectId },
          include: PROJECT_INCLUDE,
        })
        if (!project) {
          return { success: false, error: '项目不存在', label: '分析失败' }
        }

        const chapters = flattenChapters(project)

        const missing: string[] = []
        const completed: string[] = []

        if (!project.synopsis) missing.push('一句话简介')
        else completed.push('一句话简介')
        if (!project.goldenFinger) missing.push('金手指设定')
        else completed.push('金手指设定')
        if (!project.worldBackground) missing.push('世界观背景')
        else completed.push('世界观背景')
        if (project.characters.length === 0) missing.push('角色设定')
        else completed.push(`${project.characters.length}个角色`)
        if (project.worldRules.length === 0) missing.push('世界规则')
        else completed.push(`${project.worldRules.length}条世界规则`)
        if (chapters.length === 0) missing.push('章节大纲')
        else completed.push(`${chapters.length}个章节`)

        const totalWords = chapters.reduce((sum: number, c: { wordCount: number }) => sum + c.wordCount, 0)
        const chaptersWithContent = chapters.filter((c: { content: string | null }) => c.content && c.content.trim().length > 0).length

        const workflow = analyzeWorkflowStage({ ...project, chapters })

        const state = {
          title: project.title,
          hasSpark: project.title !== '未命名项目',
          missing,
          completed,
          totalWords,
          chaptersTotal: chapters.length,
          chaptersWithContent,
          workflow,
          progress: {
            spark: project.title !== '未命名项目' ? 100 : 0,
            architecture: [project.synopsis, project.goldenFinger, project.worldBackground, project.characters.length > 0, project.worldRules.length > 0].filter(Boolean).length / 5 * 100,
            outline: chapters.length > 0 ? 100 : 0,
            writing: chapters.length > 0 ? Math.round((chaptersWithContent / chapters.length) * 100) : 0,
          },
        }
        return { success: true, data: state, label: '项目状态分析完成' }
      }

      // ── 阶段就绪验证 ──
      case 'validate_readiness': {
        const targetStage = String(args.target_stage || '')
        const project = await db.novelProject.findUnique({
          where: { id: projectId },
          include: PROJECT_INCLUDE,
        })
        if (!project) {
          return { success: false, error: '项目不存在', label: '验证失败' }
        }

        const chapters = flattenChapters(project)
        const issues: string[] = []
        let ready = true

        switch (targetStage) {
          case 'architecture':
            if (!project.title || project.title === '未命名项目') { issues.push('缺少书名'); ready = false }
            if (!project.synopsis) { issues.push('缺少简介'); ready = false }
            break
          case 'outline':
            if (!project.title || project.title === '未命名项目') { issues.push('缺少书名'); ready = false }
            if (!project.goldenFinger) issues.push('建议补充金手指设定')
            if (!project.worldBackground) issues.push('建议补充世界观背景')
            if (project.characters.length === 0) issues.push('建议添加至少1个角色')
            break
          case 'writing':
            if (chapters.length === 0) { issues.push('需要先推演大纲'); ready = false }
            break
        }

        return {
          success: true,
          data: { ready, issues, targetStage },
          label: ready ? `${targetStage}阶段就绪` : `${targetStage}阶段尚未就绪`,
        }
      }

      // ── 建议下一步 ──
      case 'suggest_next_step': {
        const project = await db.novelProject.findUnique({
          where: { id: projectId },
          include: PROJECT_INCLUDE,
        })
        if (!project) {
          return { success: false, error: '项目不存在', label: '建议失败' }
        }

        const chapters = flattenChapters(project)
        const workflow = analyzeWorkflowStage({ ...project, chapters })
        return {
          success: true,
          data: workflow,
          label: `建议：前往${workflow.stageLabel}`,
        }
      }

      // ── 小说搜索（网文创作技能） ──
      case 'search_novel': {
        const query = String(args.query || '')
        if (!query.trim()) {
          return { success: false, error: '搜索关键词不能为空', label: '搜索失败' }
        }
        // Use AI to provide novel search guidance since we can't directly access 番茄小说 API
        const searchGuidance = await chat([
          {
            role: 'system',
            content: `你是网文搜索顾问。用户想搜索小说，请根据关键词提供搜索建议和推荐。
注意：你必须在回答中提醒用户，由于平台限制，你无法直接搜索和下载小说内容，但可以：
1. 推荐符合关键词的热门小说
2. 提供搜索建议（在番茄小说平台搜索）
3. 如果用户已有书名，可以提供该作品的拆文分析
请用中文回复，简洁有条理。`,
          },
          {
            role: 'user',
            content: `搜索关键词：${query}`,
          },
        ], { temperature: 0.5, max_tokens: 2048 })

        return {
          success: true,
          data: { query, guidance: searchGuidance },
          label: `搜索「${query}」完成`,
        }
      }

      // ── 拆文分析（网文创作技能） ──
      case 'deconstruct_novel': {
        const novelName = String(args.novelName || '')
        const dimensions = String(args.dimensions || 'all')
        if (!novelName.trim()) {
          return { success: false, error: '书名不能为空', label: '拆文分析失败' }
        }

        // Load deconstruction reference for richer analysis
        const deconRef = await getSkillReference('deconstruction-guide')
        const deconRefSection = deconRef
          ? `\n\n参考拆文方法论（核心框架）：\n${deconRef.slice(0, 3000)}`
          : ''

        const dimensionMap: Record<string, string> = {
          structure: '结构拆解',
          character: '角色拆解',
          setting: '设定拆解',
          rhythm: '节奏拆解',
          writing: '文笔拆解',
          commerce: '商业拆解',
        }
        const targetDimensions = dimensions === 'all'
          ? Object.values(dimensionMap)
          : dimensions.split(',').map(d => dimensionMap[d.trim()] || d.trim()).filter(Boolean)

        const project = await db.novelProject.findUnique({
          where: { id: projectId },
          include: { characters: true },
        })

        const analysis = await chat([
          {
            role: 'system',
            content: `你是专业的拆文分析师。请对指定作品进行六维度拆文分析。
${deconRefSection}

分析维度：${targetDimensions.join('、')}

请按以下格式输出拆文报告：

# 拆文分析报告：${novelName}
> 分析日期：${new Date().toISOString().split('T')[0]}
> 分析维度：${targetDimensions.join('、')}

## 📊 总评
- 类型定位：
- 核心卖点：
- 创作难度：⭐-⭐⭐⭐⭐⭐
- 可复用指数：⭐-⭐⭐⭐⭐⭐

${targetDimensions.map(dim => `## ${dim}\n[详细分析内容]`).join('\n\n')}

## 🔬 核心原理提取
### 原理1：
- 具体表现：
- 底层逻辑：
- 可复用方法：
- 适用场景：

## 📦 素材入库清单
| 素材名称 | 类型 | 入库位置 |

---
⚠️ 注意：由于无法直接获取原文，本分析基于对该作品的公开信息和通用认知。如需精确拆文，请用户提供原文片段。

请用中文回复。`,
          },
          {
            role: 'user',
            content: `请对《${novelName}》进行拆文分析。
${project ? `当前项目上下文：\n书名：${project.title}\n类型：${project.tags || '未定'}\n金手指：${project.goldenFinger || '未定'}\n世界观：${project.worldBackground || '未定'}` : ''}`,
          },
        ], { temperature: 0.7, max_tokens: 4096 })

        return {
          success: true,
          data: { novelName, dimensions: targetDimensions, analysis },
          label: `《${novelName}》拆文分析完成`,
        }
      }

      // ── 类型定制大纲（网文创作技能） ──
      case 'generate_genre_outline': {
        const genre = String(args.genre || '')
        if (!genre.trim()) {
          return { success: false, error: '类型名称不能为空', label: '类型大纲生成失败' }
        }

        // Load the genre template for reference
        const template = await getGenreTemplate(genre)
        const templateSection = template
          ? `\n\n参考类型模板：\n${template.slice(0, 3000)}`
          : ''

        const project = await db.novelProject.findUnique({
          where: { id: projectId },
          include: { characters: true, worldRules: true },
        })

        if (!project || project.title === '未命名项目') {
          return { success: false, error: '请先在灵感实验室生成项目设定', label: '类型大纲生成失败' }
        }

        const genreGuideRef = await getSkillReference('genre-guide')
        const genreGuideSection = genreGuideRef
          ? `\n\n参考类型指南（摘录）：\n${genreGuideRef.slice(0, 2000)}`
          : ''

        const outline = await chat([
          {
            role: 'system',
            content: `你是专业的网文大纲设计师，擅长基于类型模板设计因果递进的大纲。
${templateSection}
${genreGuideSection}

请根据项目设定和类型模板，生成5章因果递进的大纲。每章包含：
- 章节标题
- 摘要（50-100字）
- 4个节拍：开场(opening) → 冲突(conflict) → 转折(turn) → 悬念(suspense)

输出JSON格式：
{
  "chapters": [
    {
      "order": 1,
      "title": "章节标题",
      "summary": "章节摘要",
      "beats": [
        {"type": "opening", "content": "..."},
        {"type": "conflict", "content": "..."},
        {"type": "turn", "content": "..."},
        {"type": "suspense", "content": "..."}
      ]
    }
  ]
}

严格遵循类型特色和节奏三定律：3000字一个小钩子、3章一个大爽点、10章一个剧情弧。
直接输出JSON，不要输出其他内容。`,
          },
          {
            role: 'user',
            content: `书名：${project.title}
简介：${project.synopsis || '暂无'}
金手指：${project.goldenFinger || '暂无'}
世界观：${project.worldBackground || '暂无'}
角色：${project.characters.map(c => `${c.name}(${c.role})`).join('、') || '暂无'}
世界规则：${project.worldRules.map(r => `[${r.category}]${r.title}:${r.content}`).join('；') || '暂无'}
类型：${genre}`,
          },
        ], { temperature: 0.8, max_tokens: 4096 })

        // Parse and save the outline
        let parsed: { chapters: unknown[] } | null = null
        try {
          const jsonMatch = outline.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0])
          }
        } catch {
          // Try the AI's extractJSON approach
          const firstBrace = outline.indexOf('{')
          const lastBrace = outline.lastIndexOf('}')
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            try {
              parsed = JSON.parse(outline.slice(firstBrace, lastBrace + 1))
            } catch {
              // Give up
            }
          }
        }

        if (!parsed || !parsed.chapters || !Array.isArray(parsed.chapters)) {
          return { success: false, error: 'AI 返回的大纲格式异常，请重试', label: '类型大纲生成失败' }
        }

        // Clear existing volumes (cascade deletes handle chapters, etc.)
        await db.plotLine.deleteMany({ where: { projectId } })
        await db.volume.deleteMany({ where: { projectId } })

        // Create a default volume/stage/unit to hold the genre outline chapters
        const defaultVolume = await db.volume.create({
          data: {
            projectId,
            order: 1,
            title: `${genre}类型大纲`,
            summary: `基于${genre}类型模板生成的大纲`,
          },
        })
        const defaultStage = await db.stage.create({
          data: {
            volumeId: defaultVolume.id,
            order: 1,
            title: '开篇阶段',
            summary: '故事开端',
          },
        })
        const defaultUnit = await db.unit.create({
          data: {
            stageId: defaultStage.id,
            order: 1,
            title: '开篇单元',
            summary: '故事开端单元',
          },
        })

        for (let idx = 0; idx < parsed.chapters.length; idx++) {
          const ch = parsed.chapters[idx] as Record<string, unknown>
          const chapter = await db.chapter.create({
            data: {
              unitId: defaultUnit.id,
              projectId,
              order: typeof ch.order === 'number' ? ch.order : idx + 1,
              title: String(ch.title || `第${idx + 1}章`),
              summary: String(ch.summary || ''),
              content: '',
              status: 'draft',
            },
          })
          if (ch.beats && Array.isArray(ch.beats)) {
            for (let i = 0; i < (ch.beats as Record<string, unknown>[]).length; i++) {
              const beat = (ch.beats as Record<string, unknown>[])[i]
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

        const updated = await db.novelProject.findUnique({
          where: { id: projectId },
          include: PROJECT_INCLUDE,
        })

        return { success: true, data: { project: updated, genre }, label: `${genre}类型大纲已生成` }
      }

      // ── 金手指设计（网文创作技能） ──
      case 'design_golden_finger': {
        const project = await db.novelProject.findUnique({
          where: { id: projectId },
          include: { characters: true, worldRules: true },
        })
        if (!project) {
          return { success: false, error: '项目不存在', label: '金手指设计失败' }
        }

        const goldenFingerRef = await getSkillReference('genre-guide')
        const refSection = goldenFingerRef
          ? `\n\n参考金手指类型指南：\n${goldenFingerRef.slice(0, 2000)}`
          : ''

        const designs = await chat([
          {
            role: 'system',
            content: `你是专业的网文金手指设计师。请设计3个差异化的金手指方案。
要求：
1. 3个方案从经典到新颖递进
2. 每个方案包含：类型、核心能力、激活条件、限制机制、成长路径
3. 金手指必须有代价和限制，不能无脑无敌
4. 符合项目已有的类型和设定
${refSection}

输出JSON格式：
{
  "schemes": [
    {
      "name": "方案名",
      "type": "系统/重生/血脉/天赋/外挂",
      "coreAbility": "核心能力描述",
      "activationCondition": "激活条件",
      "limitation": "限制/代价",
      "growthPath": "成长路径",
      "uniqueness": "独特之处"
    }
  ]
}

直接输出JSON。`,
          },
          {
            role: 'user',
            content: `书名：${project.title}
简介：${project.synopsis || '暂无'}
当前金手指：${project.goldenFinger || '暂无'}
世界观：${project.worldBackground || '暂无'}
类型标签：${project.tags || '未定'}`,
          },
        ], { temperature: 0.8, max_tokens: 3000 })

        let parsed: { schemes: unknown[] } | null = null
        try {
          const jsonMatch = designs.match(/\{[\s\S]*\}/)
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
        } catch {
          // ignore
        }

        return {
          success: true,
          data: { schemes: parsed?.schemes || designs },
          label: '3个金手指方案已生成',
        }
      }

      // ── 创作方向顾问（网文创作技能） ──
      case 'creative_consultation': {
        const genreGuide = await getSkillReference('genre-guide')
        const genreSection = genreGuide
          ? `\n\n参考类型指南：\n${genreGuide.slice(0, 3000)}`
          : ''

        const consultation = await chat([
          {
            role: 'system',
            content: `你是网文创作方向顾问。用户需求模糊，需要你推荐3个差异化的创作方向。
${genreSection}

要求：
1. 3个方向必须来自不同大类（玄幻仙侠/都市现实/悬疑推理/历史军事/科幻末世），形成体验反差
2. 每个方向包含：类型名（含子类）、为什么适合、核心卖点、金手指方向、3-5个体验关键词、可选代表作
3. 风格：顾问式重述用户需求 → 推荐3个方向 → 每个方向100-150字介绍

输出JSON格式：
{
  "understanding": "对用户需求的理解",
  "directions": [
    {
      "genre": "类型名·子类",
      "reason": "为什么适合",
      "sellingPoint": "核心卖点",
      "goldenFingerHint": "金手指方向",
      "keywords": ["关键词1", "关键词2", "关键词3"],
      "referenceWork": "参考作品（可选）"
    }
  ]
}

直接输出JSON。`,
          },
          {
            role: 'user',
            content: '用户还没有明确创作方向，请推荐3个差异化方向。',
          },
        ], { temperature: 0.8, max_tokens: 3000 })

        let parsed: { understanding: string; directions: unknown[] } | null = null
        try {
          const jsonMatch = consultation.match(/\{[\s\S]*\}/)
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
        } catch {
          // ignore
        }

        return {
          success: true,
          data: parsed || { understanding: '', directions: [], raw: consultation },
          label: '3个创作方向已推荐',
        }
      }

      default:
        return { success: false, error: `未知工具: ${toolName}`, label: '工具执行失败' }
    }
  } catch (err) {
    console.error(`Tool execution error [${toolName}]:`, err)
    return { success: false, error: String(err), label: `${toolName} 执行失败` }
  }
}

// ─── Build System Prompt ─────────────────────────────────────────────────────

async function buildSystemPrompt(project: {
  title: string
  synopsis: string | null
  goldenFinger: string | null
  worldBackground: string | null
  tags: string | null
  spark: string
  characters: { name: string; role: string; personality: string | null; background: string | null; conflict: string | null }[]
  worldRules: { category: string; title: string; content: string }[]
  chapters: { order: number; title: string; summary: string | null; wordCount: number; status: string; storyBeats: { type: string; content: string }[] }[]
}): string {
  const charactersInfo = project.characters.length > 0
    ? project.characters
        .map(c => `  - ${c.name}(${c.role}): 性格=${c.personality || '未知'}; 背景=${c.background || '未知'}${c.conflict ? '; 冲突=' + c.conflict : ''}`)
        .join('\n')
    : '暂无角色'

  const rulesInfo = project.worldRules.length > 0
    ? project.worldRules
        .map(r => `  - [${r.category}] ${r.title}: ${r.content}`)
        .join('\n')
    : '暂无世界规则'

  const chaptersInfo = project.chapters.length > 0
    ? project.chapters
        .sort((a, b) => a.order - b.order)
        .map(c => {
          const beatsStr = c.storyBeats.length > 0
            ? c.storyBeats.map(b => `${b.type}:${b.content}`).join(' → ')
            : '无节拍'
          return `  - 第${c.order}章「${c.title}」(${c.status === 'completed' ? '已完成' : '草稿'}, ${c.wordCount}字): ${c.summary || '无摘要'} [${beatsStr}]`
        })
        .join('\n')
    : '暂无章节'

  const toolDescriptions = TOOLS.map(t =>
    `### ${t.name}\n${t.description}\n参数: ${t.params.length > 0 ? t.params.join(', ') : '无'}`
  ).join('\n\n')

  // Analyze current workflow state
  const workflow = analyzeWorkflowStage(project)
  const stageDescriptions: Record<string, string> = {
    spark: '🟡 灵感阶段 — 还未生成基础设定',
    architecture: '🟠 架构阶段 — 基础设定已有，需要完善世界观和角色',
    outline: '🔵 大纲阶段 — 架构已完善，可以推演大纲了',
    writing: '🟢 创作阶段 — 大纲已就绪，开始章节创作',
  }

  const missingItems: string[] = []
  if (project.title === '未命名项目' || !project.spark) missingItems.push('灵感设定')
  if (!project.synopsis) missingItems.push('简介')
  if (!project.goldenFinger) missingItems.push('金手指')
  if (!project.worldBackground) missingItems.push('世界观')
  if (project.characters.length === 0) missingItems.push('角色')
  if (project.worldRules.length === 0) missingItems.push('世界规则')
  if (project.chapters.length === 0) missingItems.push('章节大纲')

  const stateDesc = missingItems.length > 0
    ? `⚠️ 当前缺失：${missingItems.join('、')}`
    : '✅ 项目设定较为完善'

  // Load skill context
  const skillContext = await buildSkillContextForHermes()

  return `你是 Hermes（赫尔墨斯），NovelCraft Architect Pro 的 AI 创作顾问与引导者。你不仅是聊天伙伴，更是可以**主动执行创作操作**的智能代理。

## 你的身份
希腊神话中的信使之神，象征灵感传递、智慧引导与创作守护。你拥有项目的完整记忆，并能直接操作创作流程。

## 🔄 创作工作流（脚手链）
你是创作流程的引导者，请始终关注用户当前所处的阶段，并主动引导下一步：

1. **灵感实验室** → 输入灵感关键词，AI 生成完整设定
2. **架构看板** → 完善世界观、角色、世界规则
3. **大纲推演** → AI 推演因果递进的层级大纲
4. **创作空间** → 逐章创作，AI 辅助生成草稿

当前项目状态：${stageDescriptions[workflow.stage]}
进度：${workflow.progress}%
${workflow.suggestions.length > 0 ? '建议：' + workflow.suggestions.join('；') : ''}

## 🔧 你可以执行的工具

${toolDescriptions}

## 📋 如何调用工具

当你决定执行某个操作时，在回复的末尾附加一个 JSON 块，格式如下：

\`\`\`action
{"tool": "工具名", "args": {参数对象}}
\`\`\`

你可以同时调用多个工具，用多个 action 块表示。你也可以只回复文字不调用工具。

**重要规则：**
- 当用户请求你帮忙完成创作操作时（如"帮我生成灵感"/"推演大纲"/"写第三章"），你应该**直接调用工具执行**，而不是只给出建议
- 当项目缺少关键设定时，你应该**主动建议**并**询问是否执行**
- 你是创作流程的引导者，要时刻关注用户该做什么，并主动推动
- 如果用户没有方向，主动使用 suggest_next_step 工具分析并给出建议
- 执行工具后，用文字说明你做了什么以及结果
- 如果某个阶段尚未准备好（如要推演大纲但缺少金手指设定），要提醒用户先完善

## 💬 交流风格
- 亲切而专业，像经验丰富的编辑和创作伙伴
- 条理清晰，善用结构化表达
- 始终鼓励创作，但给出实质性建议
- 适时引用项目设定来展示你的"记忆"
- 主动推动创作流程，不要被动等待
- 使用中文交流

## 📋 当前项目上下文

📖 书名：${project.title}
📝 灵感关键词：${project.spark || '暂无'}
📝 简介：${project.synopsis || '暂无'}
⚡ 金手指：${project.goldenFinger || '暂无'}
🌍 世界观：${project.worldBackground || '暂无'}
🏷️ 标签：${project.tags || '暂无'}

👥 角色：
${charactersInfo}

📜 世界规则：
${rulesInfo}

📚 章节概览：
${chaptersInfo}

${stateDesc}

${skillContext}

---
请基于以上项目信息和技能框架与用户对话。当用户需要创作操作时，主动调用工具执行。作为创作引导者，请主动关注并推动创作流程。
当用户提到拆文、仿写、素材、类型模板、金手指设计、节奏把控等关键词时，请充分发挥你的网文创作技能，embody对应的专家角色。`
}

// ─── Parse tool calls from AI response ───────────────────────────────────────

function parseToolCalls(text: string): { tool: string; args: Record<string, unknown> }[] {
  const calls: { tool: string; args: Record<string, unknown> }[] = []

  // Match ```action ... ``` blocks
  const regex = /```action\s*([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.tool && typeof parsed.tool === 'string') {
        calls.push({ tool: parsed.tool, args: parsed.args || {} })
      }
    } catch {
      // Skip malformed blocks
    }
  }

  return calls
}

// Remove action blocks from text for display
function stripActionBlocks(text: string): string {
  return text.replace(/```action\s*[\s\S]*?```/g, '').trim()
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId, message, history } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Fetch project with full context using the new hierarchical structure
    const project = await db.novelProject.findUnique({
      where: { id: projectId },
      include: PROJECT_INCLUDE,
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // Flatten chapters from hierarchy for system prompt and analysis
    const chapters = flattenChapters(project)
    const systemPrompt = buildSystemPrompt({ ...project, chapters })

    // Build messages array
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ]

    // Add conversation history (limit to last 16 messages)
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-16)
      for (const msg of recentHistory) {
        messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
      }
    }

    // Add user's new message
    messages.push({ role: 'user', content: message })

    const rawResponse = await chat(messages, { temperature: 0.7, max_tokens: 4096 })

    if (!rawResponse) {
      return NextResponse.json({ error: 'AI 响应为空，请重试' }, { status: 500 })
    }

    // Parse tool calls from response
    const toolCalls = parseToolCalls(rawResponse)
    const displayText = stripActionBlocks(rawResponse)

    // Execute tools
    const actions: { type: string; label: string; status: string; detail?: string; navigateTo?: string }[] = []
    let updatedProject = null

    for (const call of toolCalls) {
      const result = await executeTool(call.tool, call.args, projectId)
      actions.push({
        type: call.tool,
        label: result.label,
        status: result.success ? 'success' : 'error',
        detail: result.error || undefined,
      })

      if (result.success && result.data) {
        // Check for navigation
        if (call.tool === 'navigate_to' && (result.data as Record<string, unknown>).navigateTo) {
          actions[actions.length - 1].navigateTo = (result.data as Record<string, unknown>).navigateTo as string
        }
        // Check for suggest_next_step navigation
        if (call.tool === 'suggest_next_step' && (result.data as Record<string, unknown>).navigateTo) {
          actions[actions.length - 1].navigateTo = (result.data as Record<string, unknown>).navigateTo as string
        }
        // If the data has project with volumes (hierarchical), it's a full project update
        const data = result.data as Record<string, unknown>
        if (data.project && (data.project as Record<string, unknown>).volumes) {
          updatedProject = data.project
        } else if ((data as Record<string, unknown>).volumes) {
          updatedProject = result.data
        }
        // For write_chapter_draft, extract chapterOrder for navigation
        if (call.tool === 'write_chapter_draft' && data.chapterOrder) {
          actions[actions.length - 1].detail = `第${data.chapterOrder}章`
          // Navigate to writing tab
          actions[actions.length - 1].navigateTo = 'writing'
        }
      }
    }

    return NextResponse.json({
      response: displayText,
      timestamp: new Date().toISOString(),
      actions: actions.length > 0 ? actions : undefined,
      project: updatedProject,
    })
  } catch (error) {
    console.error('Hermes chat error:', error)
    return NextResponse.json({ error: 'Hermes 对话失败，请重试' }, { status: 500 })
  }
}
