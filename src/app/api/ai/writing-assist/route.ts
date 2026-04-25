import { db } from '@/lib/db'
import { chat } from '@/lib/nvidia-ai'
import { NextResponse } from 'next/server'

// POST /api/ai/writing-assist - AI辅助创作
// 支持: continue(续写), rewrite(改写), suggest(建议下一步), dialogue(生成对话)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId, chapterId, mode, content, selectedText } = body

    if (!projectId || !chapterId || !mode) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    // 获取章节和项目上下文
    const chapter = await db.chapter.findUnique({
      where: { id: chapterId },
      include: { storyBeats: { orderBy: { order: 'asc' } } },
    })

    if (!chapter) {
      return NextResponse.json({ error: '章节不存在' }, { status: 404 })
    }

    const project = await db.novelProject.findUnique({
      where: { id: projectId },
      include: { characters: true, worldRules: true },
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // 构建上下文信息
    const charsInfo = project.characters
      .map((c) => `${c.name}(${c.role}): 性格=${c.personality || '未知'}`)
      .join('\n')

    const rulesInfo = project.worldRules
      .map((r) => `[${r.category}] ${r.title}: ${r.content}`)
      .join('\n')

    const beatsInfo = chapter.storyBeats
      .map((b) => `${b.type}: ${b.content}`)
      .join(' → ')

    const currentContent = content || chapter.content || ''

    // 根据模式选择不同的AI prompt
    let systemPrompt = ''
    let userPrompt = ''

    switch (mode) {
      case 'continue': {
        systemPrompt = `你是一位专业的网文写手，擅长续写章节内容。请根据已有正文和项目设定，自然地续写下一段内容。
要求：
- 续写内容约200-400字
- 严格保持已有文风和叙事视角
- 情节要连贯自然，不能突兀
- 遵循节拍指引
- 对话要生动有个性
- 直接输出续写正文，不要输出标题、标注或任何元信息`
        userPrompt = `小说：${project.title}
金手指：${project.goldenFinger || '暂无'}
世界观：${project.worldBackground || '暂无'}
角色：${charsInfo || '暂无'}
世界规则：${rulesInfo || '暂无'}

第${chapter.order}章「${chapter.title}」
摘要：${chapter.summary || '暂无'}
节拍：${beatsInfo || '暂无'}

已有正文：
${currentContent.slice(-2000)}

请续写：`
        break
      }

      case 'rewrite': {
        if (!selectedText) {
          return NextResponse.json({ error: '请先选择要改写的文本' }, { status: 400 })
        }
        systemPrompt = `你是一位专业的网文编辑，擅长润色和改写文本。请根据上下文和项目设定，改写用户选中的文本段落。
要求：
- 保持核心意思不变，但提升表达质量
- 增加画面感和细节描写
- 让对话更生动自然
- 可以调整节奏，增加张力
- 直接输出改写后的文本，不要输出任何解释或标注`
        userPrompt = `小说：${project.title}
角色：${charsInfo || '暂无'}

章节上下文：
${currentContent.slice(-1500)}

需要改写的文本：
${selectedText}

请改写：`
        break
      }

      case 'suggest': {
        systemPrompt = `你是一位专业的网文创作顾问。请根据当前章节的上下文和节拍，给出接下来可以写的方向建议。
要求：
- 给出3个不同的写作方向建议
- 每个建议50字以内
- 要结合当前情节和节拍
- 建议要有戏剧张力
- 用JSON数组格式输出：[{"title":"方向标题","desc":"简要描述"},...]`
        userPrompt = `小说：${project.title}
节拍：${beatsInfo || '暂无'}
角色：${charsInfo || '暂无'}

当前正文（最后500字）：
${currentContent.slice(-500)}

请给出下一步写作建议：`
        break
      }

      case 'dialogue': {
        systemPrompt = `你是一位擅长写对白的网文写手。请根据上下文和角色性格，为当前场景生成一段精彩的对话。
要求：
- 对话约150-300字
- 每个角色的说话风格要符合其性格设定
- 对话要有张力和信息量
- 自然融入动作描写和心理活动
- 直接输出对话内容，不要输出标题或标注`
        userPrompt = `小说：${project.title}
角色：${charsInfo || '暂无'}

第${chapter.order}章「${chapter.title}」
节拍：${beatsInfo || '暂无'}

当前正文（最后800字）：
${currentContent.slice(-800)}

请生成对话：`
        break
      }

      default:
        return NextResponse.json({ error: `不支持的模式: ${mode}` }, { status: 400 })
    }

    const response = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.8, max_tokens: 2048 })

    if (!response || !response.trim()) {
      return NextResponse.json({ error: 'AI生成失败，请重试' }, { status: 500 })
    }

    // 对于suggest模式，尝试解析JSON
    let suggestions = null
    if (mode === 'suggest') {
      try {
        // 尝试提取JSON
        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0])
        }
      } catch {
        // 解析失败就作为纯文本返回
      }
    }

    return NextResponse.json({
      result: response.trim(),
      suggestions,
      mode,
    })
  } catch (error) {
    console.error('Writing assist error:', error)
    return NextResponse.json({ error: 'AI辅助创作失败，请重试' }, { status: 500 })
  }
}
