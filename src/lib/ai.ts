import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

// 灵感激发：从碎片化关键词生成完整小说设定
export async function generateSparkExpansion(spark: string) {
  const zai = await getZAI()

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `你是一位顶尖的网文策划师和世界观架构师。你的任务是将用户提供的碎片化灵感，扩充为具有商业潜力的小说设定。你必须严格按照JSON格式输出，不要输出任何其他文字。

输出格式要求（严格JSON）：
{
  "title": "书名（要有吸引力，符合网文风格）",
  "synopsis": "一句话简介（50字以内，要有爽点和悬念）",
  "goldenFinger": "核心金手指/力量体系描述（100字以内，要有独特性和成长性）",
  "worldBackground": "世界观背景（150字以内，要有画面感和冲突基础）",
  "tags": "标签1,标签2,标签3,标签4,标签5（5个标签，用逗号分隔）",
  "characters": [
    {
      "name": "角色名",
      "role": "主角/反派/配角",
      "personality": "性格特质描述（50字以内）",
      "background": "背景档案（80字以内）",
      "conflict": "与主角的核心冲突（50字以内，仅对非主角角色）"
    }
  ]
}

要求：
- 至少生成2-3个核心人物
- 角色之间必须有明确的冲突关系
- 金手指要有成长性和限制，不能太过完美
- 世界观要为后续冲突提供土壤`,
      },
      {
        role: 'user',
        content: `灵感关键词：${spark}`,
      },
    ],
    thinking: { type: 'disabled' },
  })

  const response = completion.choices[0]?.message?.content || ''
  // 尝试提取JSON
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      return null
    }
  }
  return null
}

// 因果律大纲推演：基于设定生成前5章冲突走向
export async function generateOutline(project: {
  title: string
  synopsis: string | null
  goldenFinger: string | null
  worldBackground: string | null
  characters: { name: string; role: string; personality: string | null; background: string | null; conflict: string | null }[]
}) {
  const zai = await getZAI()

  const charactersInfo = project.characters
    .map((c) => `${c.name}(${c.role}): ${c.personality || ''} | ${c.background || ''} | ${c.conflict || ''}`)
    .join('\n')

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `你是一位经验丰富的网文大纲策划师，擅长"因果律推演"——确保每个情节都有前因后果，绝不出现逻辑断裂。

你需要根据已有的小说设定，推演前5章的冲突走向。严格按照JSON格式输出。

输出格式（严格JSON）：
{
  "chapters": [
    {
      "order": 1,
      "title": "章节标题（要有吸引力）",
      "summary": "章节摘要（100字以内，概述本章核心事件和冲突）",
      "beats": [
        { "type": "opening", "content": "开场描述（30字以内）" },
        { "type": "conflict", "content": "冲突描述（30字以内）" },
        { "type": "turn", "content": "转折描述（30字以内）" },
        { "type": "suspense", "content": "悬念描述（30字以内）" }
      ]
    }
  ]
}

要求：
- 5章之间必须有因果递进关系
- 第1章要有强烈的开篇钩子
- 金手指的获得/觉醒应在前2章内
- 每章结尾必须留下悬念
- 冲突要逐步升级，不可原地踏步`,
      },
      {
        role: 'user',
        content: `小说设定：
书名：${project.title}
简介：${project.synopsis || ''}
金手指：${project.goldenFinger || ''}
世界观：${project.worldBackground || ''}
人物：
${charactersInfo}`,
      },
    ],
    thinking: { type: 'disabled' },
  })

  const response = completion.choices[0]?.message?.content || ''
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      return null
    }
  }
  return null
}

// 章节戏剧节拍生成
export async function generateBeats(chapter: {
  title: string
  summary: string | null
}, projectContext: {
  title: string
  goldenFinger: string | null
  worldBackground: string | null
}) {
  const zai = await getZAI()

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `你是一位戏剧结构专家，擅长为网文章节设计"戏剧节拍"。按照JSON格式输出。

输出格式（严格JSON）：
{
  "beats": [
    { "type": "opening", "content": "开场节拍描述（30字以内）" },
    { "type": "conflict", "content": "冲突节拍描述（30字以内）" },
    { "type": "turn", "content": "转折节拍描述（30字以内）" },
    { "type": "suspense", "content": "悬念节拍描述（30字以内）" }
  ]
}

要求：每个type只能出现一次，节拍之间要有因果逻辑。`,
      },
      {
        role: 'user',
        content: `章节：${chapter.title}
摘要：${chapter.summary || ''}
小说：${projectContext.title}
金手指：${projectContext.goldenFinger || ''}
世界观：${projectContext.worldBackground || ''}`,
      },
    ],
    thinking: { type: 'disabled' },
  })

  const response = completion.choices[0]?.message?.content || ''
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      return null
    }
  }
  return null
}
