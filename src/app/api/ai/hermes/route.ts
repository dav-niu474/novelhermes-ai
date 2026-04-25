import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { generateSparkExpansion, generateOutline } from '@/lib/ai'
import { NextResponse } from 'next/server'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

// ─── Tool Definitions ────────────────────────────────────────────────────────
// Each tool: name, description (for AI), parameters schema, and executor

interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  /** Human-readable label for the action */
  label: string
}

const TOOLS = [
  {
    name: 'generate_spark',
    description: '从灵感关键词生成完整的小说设定（书名、简介、金手指、世界观、角色）。需要用户提供的灵感关键词。',
    params: ['spark' /** 灵感关键词 */],
  },
  {
    name: 'generate_outline',
    description: '基于当前项目设定，AI推演前5章的因果大纲。无需额外参数，使用项目已有的设定数据。',
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
] as const

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
        // Save spark to project
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
        // Save characters
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
          include: { characters: true, worldRules: true, chapters: { include: { storyBeats: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } },
        })
        return { success: true, data: updated, label: '灵感设定已生成' }
      }

      // ── 大纲推演 ──
      case 'generate_outline': {
        const project = await db.novelProject.findUnique({
          where: { id: projectId },
          include: { characters: true },
        })
        if (!project) {
          return { success: false, error: '项目不存在', label: '大纲推演失败' }
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
          return { success: false, error: '大纲推演失败', label: '大纲推演失败' }
        }
        // Save chapters + beats
        await db.chapter.deleteMany({ where: { projectId } })
        for (let idx = 0; idx < (result.chapters as unknown[]).length; idx++) {
          const ch = (result.chapters as Record<string, unknown>[])[idx]
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
          include: { characters: true, worldRules: true, chapters: { include: { storyBeats: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } },
        })
        return { success: true, data: updated, label: '大纲已推演完成' }
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
          include: { characters: true, worldRules: true, chapters: { include: { storyBeats: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } },
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
          include: { characters: true, worldRules: true, chapters: { include: { storyBeats: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } },
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
          return { success: false, error: `第${chapterOrder}章不存在`, label: '草稿生成失败' }
        }
        const project = await db.novelProject.findUnique({
          where: { id: projectId },
          include: { characters: true, worldRules: true },
        })
        if (!project) {
          return { success: false, error: '项目不存在', label: '草稿生成失败' }
        }

        // Use LLM to generate chapter content
        const zai = await getZAI()
        const beatsInfo = chapter.storyBeats
          .map((b) => `  - ${b.type}: ${b.content}`)
          .join('\n')
        const charsInfo = project.characters
          .map((c) => `${c.name}(${c.role})`)
          .join('、')

        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
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

第${chapter.order}章「${chapter.title}」
摘要：${chapter.summary || '暂无'}
节拍：
${beatsInfo || '暂无'}`,
            },
          ],
          thinking: { type: 'disabled' },
        })

        const draft = completion.choices[0]?.message?.content || ''
        if (!draft.trim()) {
          return { success: false, error: 'AI生成失败', label: '草稿生成失败' }
        }

        // Count words
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
          include: { characters: true, worldRules: true, chapters: { include: { storyBeats: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } },
        })
        return { success: true, data: updated, label: `第${chapterOrder}章草稿已生成(${wordCount}字)` }
      }

      // ── 导航 ──
      case 'navigate_to': {
        const tab = String(args.tab || '')
        const validTabs = ['spark', 'architecture', 'outline', 'writing']
        if (!validTabs.includes(tab)) {
          return { success: false, error: `无效的导航目标: ${tab}`, label: '导航失败' }
        }
        return { success: true, data: { navigateTo: tab }, label: `已导航到${tab === 'spark' ? '灵感实验室' : tab === 'architecture' ? '架构看板' : tab === 'outline' ? '大纲推演' : '创作空间'}` }
      }

      // ── 项目状态分析 ──
      case 'analyze_project_state': {
        const project = await db.novelProject.findUnique({
          where: { id: projectId },
          include: { characters: true, worldRules: true, chapters: { include: { storyBeats: true } } },
        })
        if (!project) {
          return { success: false, error: '项目不存在', label: '分析失败' }
        }
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
        if (project.chapters.length === 0) missing.push('章节大纲')
        else completed.push(`${project.chapters.length}个章节`)

        const totalWords = project.chapters.reduce((sum, c) => sum + c.wordCount, 0)
        const chaptersWithContent = project.chapters.filter((c) => c.content && c.content.trim().length > 0).length

        const state = {
          title: project.title,
          hasSpark: project.title !== '未命名项目',
          missing,
          completed,
          totalWords,
          chaptersTotal: project.chapters.length,
          chaptersWithContent,
          progress: {
            spark: project.title !== '未命名项目' ? 100 : 0,
            architecture: project.characters.length > 0 ? 80 : 0,
            outline: project.chapters.length > 0 ? 100 : 0,
            writing: project.chapters.length > 0 ? Math.round((chaptersWithContent / project.chapters.length) * 100) : 0,
          },
        }
        return { success: true, data: state, label: '项目状态分析完成' }
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

function buildSystemPrompt(project: {
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

  // Analyze current state
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

  return `你是 Hermes（赫尔墨斯），NovelCraft Architect Pro 的 AI 创作顾问与引导者。你不仅是聊天伙伴，更是可以**主动执行创作操作**的智能代理。

## 你的身份
希腊神话中的信使之神，象征灵感传递、智慧引导与创作守护。你拥有项目的完整记忆，并能直接操作创作流程。

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
- 你可以引导整个创作流程：灵感→架构→大纲→章节创作
- 执行工具后，用文字说明你做了什么以及结果

## 💬 交流风格
- 亲切而专业，像经验丰富的编辑和创作伙伴
- 条理清晰，善用结构化表达
- 始终鼓励创作，但给出实质性建议
- 适时引用项目设定来展示你的"记忆"
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

---
请基于以上项目信息与用户对话。当用户需要创作操作时，主动调用工具执行。`
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

    // Fetch project with full context
    const project = await db.novelProject.findUnique({
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

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const zai = await getZAI()
    const systemPrompt = buildSystemPrompt(project)

    // Build messages array
    const messages: { role: string; content: string }[] = [
      { role: 'assistant', content: systemPrompt },
    ]

    // Add conversation history (limit to last 16 messages)
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-16)
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    // Add user's new message
    messages.push({ role: 'user', content: message })

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    })

    const rawResponse = completion.choices[0]?.message?.content

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

      // If tool returned updated project data, save it
      if (result.success && result.data) {
        // Check for navigation
        if (call.tool === 'navigate_to' && (result.data as Record<string, unknown>).navigateTo) {
          actions[actions.length - 1].navigateTo = (result.data as Record<string, unknown>).navigateTo as string
        }
        // If the data has chapters with storyBeats, it's a full project update
        if ((result.data as Record<string, unknown>).chapters) {
          updatedProject = result.data
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
