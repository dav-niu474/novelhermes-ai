import { chat } from '@/lib/nvidia-ai'

// ─── Retry wrapper for AI calls ────────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  label: string = 'AI'
): Promise<T> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      console.warn(`${label} attempt ${attempt + 1} failed:`, err)
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }
  throw lastError
}

// 鲁棒的 JSON 提取：从 AI 响应中提取 JSON
function extractJSON(text: string): Record<string, unknown> | null {
  if (!text || text.trim().length === 0) return null

  // 尝试1: 直接解析
  try {
    return JSON.parse(text.trim())
  } catch {
    // continue
  }

  // 尝试2: 提取 markdown code block 中的 JSON
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {
      // continue
    }
  }

  // 尝试3: 查找第一个 { 到最后一个 } 之间的内容
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1))
    } catch {
      // continue
    }
  }

  // 尝试4: 逐步修复常见问题
  let cleaned = text
  // 移除控制字符
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, (char) => {
    if (char === '\n' || char === '\r' || char === '\t') return char
    return ''
  })
  const cb2 = cleaned.indexOf('{')
  const lb2 = cleaned.lastIndexOf('}')
  if (cb2 !== -1 && lb2 > cb2) {
    try {
      return JSON.parse(cleaned.substring(cb2, lb2 + 1))
    } catch {
      // give up
    }
  }

  return null
}

// 灵感激发：从碎片化关键词生成完整小说设定
export async function generateSparkExpansion(spark: string) {
  const result = await withRetry(async () => {
    const response = await chat([
      {
        role: 'system',
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
- 世界观要为后续冲突提供土壤
- 只输出JSON，不要有任何其他文字`,
      },
      {
        role: 'user',
        content: `灵感关键词：${spark}`,
      },
    ], { temperature: 0.8 })

    const parsed = extractJSON(response)
    if (!parsed) throw new Error('灵感生成返回格式异常，重试中...')
    return parsed
  }, 2, '灵感生成')

  return result
}

// ─── 层级大纲生成：卷→阶段→单元→章 + 剧情线 ────────────────────────────
export async function generateHierarchicalOutline(project: {
  title: string
  synopsis: string | null
  goldenFinger: string | null
  worldBackground: string | null
  characters: { name: string; role: string; personality: string | null; background: string | null; conflict: string | null }[]
}) {
  const charactersInfo = project.characters.length > 0
    ? project.characters
        .map((c) => `${c.name}(${c.role}): ${c.personality || ''} | ${c.background || ''} | ${c.conflict || ''}`)
        .join('\n')
    : '暂无角色设定'

  const result = await withRetry(async () => {
    const response = await chat([
      {
        role: 'system',
        content: `你是一位顶尖网文架构师，擅长"因果律推演"和"多层叙事结构"设计。你需要根据小说设定，构建完整的层级大纲和剧情线。严格按照JSON格式输出，不要输出任何其他文字。

输出格式（严格JSON）：
{
  "volumes": [
    {
      "title": "卷名（有吸引力，概括本卷核心冲突）",
      "summary": "本卷摘要（100字以内）",
      "order": 1,
      "stages": [
        {
          "title": "阶段名（如：崛起、危机、转折等）",
          "summary": "阶段摘要（80字以内）",
          "order": 1,
          "units": [
            {
              "title": "单元名（如：初入宗门、秘境探险等）",
              "summary": "单元摘要（60字以内）",
              "order": 1,
              "chapterPlan": "本单元章节规划说明（50字以内）",
              "chapters": [
                {
                  "title": "章名（要有吸引力）",
                  "summary": "章节摘要（80字以内）",
                  "order": 1,
                  "plotPoints": ["要点1", "要点2"],
                  "beats": [
                    { "type": "opening", "content": "开场描述（30字以内）" },
                    { "type": "conflict", "content": "冲突描述（30字以内）" },
                    { "type": "turn", "content": "转折描述（30字以内）" },
                    { "type": "suspense", "content": "悬念描述（30字以内）" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "plotLines": [
    {
      "type": "main",
      "title": "主线名称",
      "description": "主线描述（100字以内）",
      "color": "#10b981",
      "plotPoints": [
        {
          "targetLevel": "volume",
          "targetOrder": 1,
          "title": "剧情点标题",
          "description": "剧情点描述（50字以内）"
        }
      ]
    },
    {
      "type": "side",
      "title": "支线名称",
      "description": "支线描述（80字以内）",
      "color": "#f59e0b",
      "plotPoints": [
        {
          "targetLevel": "stage",
          "targetOrder": 1,
          "title": "支线剧情点标题",
          "description": "支线剧情点描述（50字以内）"
        }
      ]
    }
  ]
}

结构要求：
- 生成1-3个卷（volume），根据故事规模调整
- 每卷2-3个阶段（stage）
- 每阶段2-3个单元（unit）
- 每单元2-4个章（chapter）
- 必须有1条主线（type="main"），1-2条支线（type="side"）
- 主线plotPoints的targetLevel可以是volume/stage/unit/chapter
- 支线plotPoints的targetLevel建议为stage或unit级别
- targetOrder指的是该level在同级别中的顺序（从1开始）

内容要求：
- 卷与卷之间要有大的弧线递进
- 阶段之间要有因果逻辑
- 第1章必须有强烈的开篇钩子
- 金手指的获得/觉醒应在前2章内
- 每章结尾必须留下悬念
- 冲突要逐步升级，不可原地踏步
- 主线贯穿全局，支线服务于人物成长或世界观展开
- 只输出JSON，不要有任何其他文字`,
      },
      {
        role: 'user',
        content: `小说设定：
书名：${project.title}
简介：${project.synopsis || '暂无'}
金手指：${project.goldenFinger || '暂无'}
世界观：${project.worldBackground || '暂无'}
人物：
${charactersInfo}`,
      },
    ], { temperature: 0.7, max_tokens: 4096 })

    const parsed = extractJSON(response)
    if (!parsed || !parsed.volumes) throw new Error('层级大纲生成返回格式异常，重试中...')
    return parsed
  }, 2, '层级大纲生成')

  return result
}

// ─── 单元章节规划生成 ──────────────────────────────────────────────────────
export async function generateUnitChapterPlan(
  unit: { title: string; summary: string | null },
  projectContext: {
    title: string
    synopsis: string | null
    goldenFinger: string | null
    worldBackground: string | null
    plotLines: { type: string; title: string; plotPoints: { title: string; description: string | null }[] }[]
  }
) {
  const plotLinesInfo = projectContext.plotLines.length > 0
    ? projectContext.plotLines
        .map((pl) => `[${pl.type === 'main' ? '主线' : '支线'}] ${pl.title}: ${pl.plotPoints.map((pp) => pp.title).join('→')}`)
        .join('\n')
    : '暂无剧情线'

  const result = await withRetry(async () => {
    const response = await chat([
      {
        role: 'system',
        content: `你是一位专业的网文章节规划师。你需要根据单元信息和项目上下文，为该单元生成详细的章节规划。严格按照JSON格式输出，不要输出任何其他文字。

输出格式（严格JSON）：
{
  "chapters": [
    {
      "title": "章名（要有吸引力）",
      "summary": "章节摘要（80字以内）",
      "order": 1,
      "plotPoints": ["要点1", "要点2"],
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
- 生成2-4个章节
- 章节之间要有因果递进关系
- 每章要有明确的冲突和悬念
- 结合剧情线来安排情节要点
- plotPoints要与剧情线的剧情点相呼应
- 只输出JSON，不要有任何其他文字`,
      },
      {
        role: 'user',
        content: `小说：${projectContext.title}
简介：${projectContext.synopsis || '暂无'}
金手指：${projectContext.goldenFinger || '暂无'}
世界观：${projectContext.worldBackground || '暂无'}
剧情线：
${plotLinesInfo}

当前单元：${unit.title}
单元摘要：${unit.summary || '暂无'}

请生成该单元的章节规划：`,
      },
    ], { temperature: 0.7 })

    const parsed = extractJSON(response)
    if (!parsed || !parsed.chapters) throw new Error('单元章节规划生成返回格式异常，重试中...')
    return parsed
  }, 2, '单元章节规划')

  return result
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
  const result = await withRetry(async () => {
    const response = await chat([
      {
        role: 'system',
        content: `你是一位戏剧结构专家，擅长为网文章节设计"戏剧节拍"。按照JSON格式输出，不要输出任何其他文字。

输出格式（严格JSON）：
{
  "beats": [
    { "type": "opening", "content": "开场节拍描述（30字以内）" },
    { "type": "conflict", "content": "冲突节拍描述（30字以内）" },
    { "type": "turn", "content": "转折节拍描述（30字以内）" },
    { "type": "suspense", "content": "悬念节拍描述（30字以内）" }
  ]
}

要求：每个type只能出现一次，节拍之间要有因果逻辑。只输出JSON。`,
      },
      {
        role: 'user',
        content: `章节：${chapter.title}
摘要：${chapter.summary || '暂无'}
小说：${projectContext.title}
金手指：${projectContext.goldenFinger || '暂无'}
世界观：${projectContext.worldBackground || '暂无'}`,
      },
    ], { temperature: 0.7 })

    const parsed = extractJSON(response)
    if (!parsed || !parsed.beats) throw new Error('节拍生成返回格式异常，重试中...')
    return parsed
  }, 2, '节拍生成')

  return result
}
