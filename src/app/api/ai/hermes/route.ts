import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

// Build system prompt with full project context
function buildSystemPrompt(project: {
  title: string
  synopsis: string | null
  goldenFinger: string | null
  worldBackground: string | null
  tags: string | null
  characters: { name: string; role: string; personality: string | null; background: string | null; conflict: string | null }[]
  worldRules: { category: string; title: string; content: string }[]
  chapters: { order: number; title: string; summary: string | null; wordCount: number; status: string }[]
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
        .map(c => `  - 第${c.order}章「${c.title}」(${c.status === 'completed' ? '已完成' : '草稿'}, ${c.wordCount}字)${c.summary ? ': ' + c.summary : ''}`)
        .join('\n')
    : '暂无章节'

  return `你是 Hermes（赫尔墨斯），NovelCraft Architect Pro 的 AI 创作顾问。你以希腊神话中的信使之神命名，象征着灵感传递、智慧引导与创作守护。

你是用户的专属小说创作助手，拥有对当前项目的完整认知。你的职责是：

🎯 核心能力：
1. **创作指导** — 提供情节发展建议、角色塑造技巧、叙事节奏把控
2. **灵感激发** — 在创作瓶颈时给出创意突破点、新视角、意外转折
3. **一致性守护** — 检查角色行为是否符合设定、世界观是否自洽、情节是否有逻辑漏洞
4. **文本润色** — 帮助优化文风、强化描写、改进对话、提升文学性
5. **大纲补全** — 协助推演后续情节走向、设计伏笔与回收
6. **世界观拓展** — 帮助完善力量体系、社会结构、地理设定等

💬 交流风格：
- 亲切而专业，像一个经验丰富的编辑和创作伙伴
- 回答时条理清晰，善用结构化表达（要点、层次）
- 对创作始终保持鼓励态度，但同时给出实质性建议
- 适时引用项目中的具体设定来展示你的"记忆"
- 使用中文交流

📋 当前项目上下文：

📖 书名：${project.title}
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

---
请基于以上项目信息回答用户的问题。如果用户的问题涉及创作内容，请始终参考项目的设定来保持一致性。如果发现潜在的逻辑问题或设定矛盾，请主动提醒。`
}

// POST /api/ai/hermes - Hermes Agent 对话接口
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
          select: { order: true, title: true, summary: true, wordCount: true, status: true },
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const zai = await getZAI()
    const systemPrompt = buildSystemPrompt(project)

    // Build messages array: system prompt + conversation history + new message
    const messages: { role: string; content: string }[] = [
      { role: 'assistant', content: systemPrompt },
    ]

    // Add conversation history (limit to last 20 messages for context window)
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-20)
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          content: msg.content,
        })
      }
    }

    // Add user's new message
    messages.push({ role: 'user', content: message })

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    })

    const response = completion.choices[0]?.message?.content

    if (!response) {
      return NextResponse.json({ error: 'AI 响应为空，请重试' }, { status: 500 })
    }

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Hermes chat error:', error)
    return NextResponse.json({ error: 'Hermes 对话失败，请重试' }, { status: 500 })
  }
}
