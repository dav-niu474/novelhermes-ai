// ===== Skill Loader Utility =====
// Reads skill files from the filesystem and manages skill lifecycle

import { readFile, readdir, stat, writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { execSync } from 'child_process'

const SKILLS_DIR = join(process.cwd(), 'skills')
const WANGWEN_SKILL_DIR = join(SKILLS_DIR, 'wangwen-creative')
const WANGWEN_REPO_URL = 'https://github.com/dav-niu474/wangwen-creative.git'

export interface SkillMeta {
  name: string
  description: string
  version: string
  lastUpdated: string
  path: string
}

export interface SkillContent {
  meta: SkillMeta
  mainDoc: string        // SKILL.md content
  references: Record<string, string>  // reference docs
  genreTemplates: Record<string, string>  // genre template docs
}

/**
 * Parse the YAML-like frontmatter from SKILL.md
 */
function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return { name: 'unknown', description: '' }

  const frontmatter = match[1]
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m)

  return {
    name: nameMatch?.[1]?.trim() || 'unknown',
    description: descMatch?.[1]?.trim() || '',
  }
}

/**
 * Get the last modified date of a file
 */
async function getLastModified(filePath: string): Promise<string> {
  try {
    const stats = await stat(filePath)
    return stats.mtime.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

/**
 * List all available skills
 */
export async function listSkills(): Promise<SkillMeta[]> {
  const skills: SkillMeta[] = []

  try {
    const entries = await readdir(SKILLS_DIR)
    for (const entry of entries) {
      const skillPath = join(SKILLS_DIR, entry)
      const skillMdPath = join(skillPath, 'SKILL.md')
      try {
        const stats = await stat(skillPath)
        if (!stats.isDirectory()) continue
        const content = await readFile(skillMdPath, 'utf-8')
        const { name, description } = parseFrontmatter(content)
        const lastUpdated = await getLastModified(skillMdPath)
        skills.push({
          name,
          description: description.slice(0, 200),
          version: lastUpdated,
          lastUpdated,
          path: skillPath,
        })
      } catch {
        // Not a valid skill directory, skip
      }
    }
  } catch {
    // Skills directory doesn't exist
  }

  return skills
}

/**
 * Load the wangwen-creative skill content
 */
export async function loadWangwenSkill(): Promise<SkillContent | null> {
  try {
    const skillMdPath = join(WANGWEN_SKILL_DIR, 'SKILL.md')
    const mainDoc = await readFile(skillMdPath, 'utf-8')
    const { name, description } = parseFrontmatter(mainDoc)
    const lastUpdated = await getLastModified(skillMdPath)

    // Load reference documents
    const references: Record<string, string> = {}
    const refsDir = join(WANGWEN_SKILL_DIR, 'references')
    try {
      const refFiles = await readdir(refsDir)
      for (const file of refFiles) {
        if (file.endsWith('.md')) {
          const content = await readFile(join(refsDir, file), 'utf-8')
          references[file.replace('.md', '')] = content
        }
      }
    } catch {
      // No references directory
    }

    // Load genre templates
    const genreTemplates: Record<string, string> = {}
    const templatesDir = join(WANGWEN_SKILL_DIR, 'assets', 'genre-templates')
    try {
      const templateFiles = await readdir(templatesDir)
      for (const file of templateFiles) {
        if (file.endsWith('.md')) {
          const content = await readFile(join(templatesDir, file), 'utf-8')
          genreTemplates[file.replace('.md', '')] = content
        }
      }
    } catch {
      // No templates directory
    }

    return {
      meta: {
        name,
        description,
        version: lastUpdated,
        lastUpdated,
        path: WANGWEN_SKILL_DIR,
      },
      mainDoc,
      references,
      genreTemplates,
    }
  } catch (err) {
    console.error('Failed to load wangwen-creative skill:', err)
    return null
  }
}

/**
 * Build a condensed skill context for injection into Hermes system prompt.
 * Only includes the most relevant parts to avoid token overflow.
 */
export async function buildSkillContextForHermes(): Promise<string> {
  const skill = await loadWangwenSkill()
  if (!skill) {
    return ''
  }

  // Extract key sections from SKILL.md instead of including the whole doc
  // The full SKILL.md is ~45KB, so we extract key principles only to manage token limits
  const mainDoc = skill.mainDoc

  // Extract core principles (sections 1-8)
  const principlesMatch = mainDoc.match(/## 核心哲学[\s\S]*?(?=## 小说搜索下载能力)/)
  const principles = principlesMatch ? principlesMatch[0].trim() : ''

  // Extract core rule #0
  const ruleZeroMatch = mainDoc.match(/## 核心原则 #0[\s\S]*?(?=## 核心哲学)/)
  const ruleZero = ruleZeroMatch ? ruleZeroMatch[0].trim() : ''

  // Extract workflow section (condensed)
  const workflowMatch = mainDoc.match(/## 工作流程[\s\S]*?(?=## 交付自检)/)
  const workflow = workflowMatch
    ? workflowMatch[0].trim().slice(0, 2000)
    : ''

  const refList = Object.keys(skill.references).join('、')
  const templateList = Object.keys(skill.genreTemplates).join('、')

  return `
## 🎨 网文创作技能 · Wangwen-Creative（已加载）

你已装备「网文创作」专业技能框架。根据任务embody不同专家：拆文分析师/世界观架构师/大纲设计师/网文写手/素材管理员/仿写教练。

${ruleZero}

${principles}

### 工作流程（精简版）
${workflow}

### 📚 可用参考文档（按需加载）
${refList}

### 📖 可用类型模板（按需加载）
${templateList}

### 🔧 技能使用原则
1. **根据任务embody对应领域的专家**：拆文分析师/世界观架构师/大纲设计师/网文写手/素材管理员/仿写教练
2. **遵循核心哲学**：从已有设定出发、Junior Writer模式（先骨架后血肉）、给变体不给唯一答案
3. **反AI写作slop**：金手指有代价、升级有瓶颈、打脸有铺垫、伏笔有回收、角色有弧光、世界观有矛盾
4. **节奏三定律**：3000字定律/3章定律/10章定律
5. **当用户需求模糊时**：进入创作方向顾问模式，推荐3个差异化方向
6. **事实尊重先于想象**：涉及具体网文作品时必须搜索验证
7. **拆文与抄袭的边界**：提取原理不是照搬情节，"三换原则"验证原创性
`
}

/**
 * Update the wangwen-creative skill from GitHub
 * Returns the update result with version info
 */
export async function updateWangwenSkill(): Promise<{
  success: boolean
  message: string
  version?: string
}> {
  try {
    // Create a temp directory for cloning
    const tempDir = join(process.cwd(), '.tmp-skill-update')

    // Clean up any existing temp dir
    try {
      await rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore
    }

    // Clone the latest version
    console.log('Cloning latest wangwen-creative from GitHub...')
    execSync(`git clone --depth 1 ${WANGWEN_REPO_URL} "${tempDir}"`, {
      stdio: 'pipe',
      timeout: 60000,
    })

    // Remove .git from the clone
    try {
      await rm(join(tempDir, '.git'), { recursive: true, force: true })
    } catch {
      // Ignore
    }

    // Verify the clone has SKILL.md
    try {
      await readFile(join(tempDir, 'SKILL.md'), 'utf-8')
    } catch {
      await rm(tempDir, { recursive: true, force: true })
      return { success: false, message: '克隆的仓库缺少 SKILL.md，可能不是有效的技能仓库' }
    }

    // Remove the existing skill directory
    try {
      await rm(WANGWEN_SKILL_DIR, { recursive: true, force: true })
    } catch {
      // May not exist yet
    }

    // Ensure skills directory exists
    await mkdir(SKILLS_DIR, { recursive: true })

    // Move the cloned content to the skills directory
    execSync(`mv "${tempDir}" "${WANGWEN_SKILL_DIR}"`, { stdio: 'pipe' })

    // Read the new version info
    const skill = await loadWangwenSkill()
    const version = skill?.meta.lastUpdated || new Date().toISOString()

    return {
      success: true,
      message: `网文创作技能已更新到最新版本`,
      version,
    }
  } catch (err) {
    console.error('Failed to update wangwen-creative skill:', err)
    return {
      success: false,
      message: `更新失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Get a specific reference document by name
 */
export async function getSkillReference(refName: string): Promise<string | null> {
  try {
    const refPath = join(WANGWEN_SKILL_DIR, 'references', `${refName}.md`)
    return await readFile(refPath, 'utf-8')
  } catch {
    return null
  }
}

/**
 * Get a specific genre template by name
 */
export async function getGenreTemplate(templateName: string): Promise<string | null> {
  try {
    const templatePath = join(WANGWEN_SKILL_DIR, 'assets', 'genre-templates', `${templateName}.md`)
    return await readFile(templatePath, 'utf-8')
  } catch {
    return null
  }
}
