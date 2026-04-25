// ===== NovelCraft Architect Pro - Core Types =====

export interface NovelProject {
  id: string
  spark: string
  title: string
  synopsis: string | null
  goldenFinger: string | null
  worldBackground: string | null
  tags: string | null
  createdAt: string
  updatedAt: string
  characters: Character[]
  worldRules: WorldRule[]
  volumes: Volume[]
  plotLines: PlotLine[]
}

export interface Character {
  id: string
  projectId: string
  name: string
  role: string
  personality: string | null
  background: string | null
  conflict: string | null
}

export interface WorldRule {
  id: string
  projectId: string
  category: string
  title: string
  content: string
}

// ─── Hierarchical Outline: 卷 → 阶段 → 单元 → 章 ───

export interface Volume {
  id: string
  projectId: string
  order: number
  title: string
  summary: string | null
  stages: Stage[]
}

export interface Stage {
  id: string
  volumeId: string
  order: number
  title: string
  summary: string | null
  units: Unit[]
}

export interface Unit {
  id: string
  stageId: string
  order: number
  title: string
  summary: string | null
  chapterPlan: string | null // JSON string
  chapters: Chapter[]
}

export interface Chapter {
  id: string
  unitId: string
  projectId: string
  order: number
  title: string
  summary: string | null
  content: string | null
  plotPoints: string | null // JSON string: 章节剧情要点
  wordCount: number
  status: string
  storyBeats: StoryBeat[]
}

export interface StoryBeat {
  id: string
  chapterId: string
  type: 'opening' | 'conflict' | 'turn' | 'suspense'
  content: string
  order: number
}

export type BeatType = 'opening' | 'conflict' | 'turn' | 'suspense'

export const BEAT_TYPE_LABELS: Record<BeatType, string> = {
  opening: '开场',
  conflict: '冲突',
  turn: '转折',
  suspense: '悬念',
}

export const BEAT_TYPE_COLORS: Record<BeatType, string> = {
  opening: 'bg-emerald-500',
  conflict: 'bg-red-500',
  turn: 'bg-amber-500',
  suspense: 'bg-purple-500',
}

// ─── Plot Lines & Plot Points ───

export interface PlotLine {
  id: string
  projectId: string
  type: 'main' | 'side' // 主线/支线
  title: string
  description: string | null
  order: number
  color: string | null
  plotPoints: PlotPoint[]
}

export interface PlotPoint {
  id: string
  plotLineId: string
  targetLevel: 'volume' | 'stage' | 'unit' | 'chapter'
  targetId: string
  order: number
  title: string
  description: string | null
  status: 'planned' | 'writing' | 'completed'
}

// ===== Hermes Agent Types =====

export interface HermesMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  /** Actions executed by the agent alongside this message */
  actions?: HermesAction[]
  /** Adoptable content that can be filled into the left panel */
  adoptOptions?: HermesAdoptOption[]
}

export type HermesActionType =
  | 'generate_spark'
  | 'generate_outline'
  | 'add_character'
  | 'add_world_rule'
  | 'update_project'
  | 'navigate_to'
  | 'write_chapter_draft'
  | 'validate_readiness'
  | 'suggest_next_step'

export interface HermesAction {
  type: HermesActionType
  label: string        // Human-readable label e.g. "已生成灵感设定"
  status: 'running' | 'success' | 'error'
  detail?: string      // Optional detail
}

// ─── Adopt Option Types ─────────────────────────────────────────────────────

export type AdoptTargetType = 'project_field' | 'character' | 'world_rule' | 'chapter_content' | 'spark'

export interface HermesAdoptOption {
  /** Unique ID for this adopt option */
  id: string
  /** Human-readable label */
  label: string
  /** The type of target to adopt into */
  type: AdoptTargetType
  /** The data to adopt */
  data: Record<string, unknown>
}

export interface HermesConversation {
  projectId: string
  messages: HermesMessage[]
}

// ===== App Tab Types =====

export type AppTab = 'spark' | 'architecture' | 'outline' | 'writing'

export const TAB_LABELS: Record<AppTab, string> = {
  spark: '灵感实验室',
  architecture: '架构看板',
  outline: '大纲推演',
  writing: '创作空间',
}

// ===== Plot Line Color Presets =====

export const PLOT_LINE_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
]

export const PLOT_LINE_TYPE_LABELS: Record<string, string> = {
  main: '主线',
  side: '支线',
}
