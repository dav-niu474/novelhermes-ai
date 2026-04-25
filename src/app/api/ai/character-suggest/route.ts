import { db } from '@/lib/db'
import { chat } from '@/lib/nvidia-ai'
import { NextResponse } from 'next/server'

// POST /api/ai/character-suggest - AI生成角色方案
// 根据项目设定生成3个不同的角色方案供用户选择
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId, roleType } = body

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 })
    }

    const project = await db.novelProject.findUnique({
      where: { id: projectId },
      include: { characters: true, worldRules: true },
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // 构建已有角色信息，避免重复
    const existingChars = project.characters
      .map((c) => `${c.name}(${c.role})`)
      .join('、')

    const rulesInfo = project.worldRules
      .map((r) => `[${r.category}] ${r.title}: ${r.content}`)
      .join('\n')

    const targetRole = roleType || '任意'

    const systemPrompt = `你是一位顶尖的网文角色设计师。根据小说的世界观和现有设定，生成3个不同风格的角色方案供用户选择。

要求：
- 每个角色方案都要有独特的性格和背景
- 角色之间要有冲突关系
- 符合小说的世界观设定
- ${targetRole !== '任意' ? `角色类型应为"${targetRole}"` : '角色类型可以多样（主角/反派/配角）'}
- 严格按照JSON格式输出，不要输出任何其他文字

输出格式：
[
  {
    "name": "角色名",
    "role": "主角/反派/配角",
    "personality": "性格特质（50字以内）",
    "background": "背景档案（80字以内）",
    "conflict": "与主角的核心冲突（50字以内，仅对非主角角色）"
  }
]`

    const userPrompt = `小说：${project.title}
简介：${project.synopsis || '暂无'}
金手指：${project.goldenFinger || '暂无'}
世界观：${project.worldBackground || '暂无'}
世界规则：${rulesInfo || '暂无'}
已有角色：${existingChars || '暂无'}

请生成3个角色方案：`

    const response = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.85, max_tokens: 2048 })

    if (!response || !response.trim()) {
      return NextResponse.json({ error: 'AI生成失败，请重试' }, { status: 500 })
    }

    // 解析JSON响应
    let characters = null
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        characters = JSON.parse(jsonMatch[0])
      }
    } catch {
      // 尝试直接解析
      try {
        characters = JSON.parse(response.trim())
      } catch {
        // 解析失败
      }
    }

    if (!characters || !Array.isArray(characters)) {
      return NextResponse.json({ error: 'AI返回格式异常，请重试', raw: response }, { status: 500 })
    }

    return NextResponse.json({
      characters,
    })
  } catch (error) {
    console.error('Character suggest error:', error)
    return NextResponse.json({ error: 'AI角色生成失败，请重试' }, { status: 500 })
  }
}
