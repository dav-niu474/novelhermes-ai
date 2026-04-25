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
  chapters: Chapter[]
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

export interface Chapter {
  id: string
  projectId: string
  order: number
  title: string
  summary: string | null
  content: string | null
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

// ===== Hermes Agent Types =====

export interface HermesMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  /** Actions executed by the agent alongside this message */
  actions?: HermesAction[]
}

export type HermesActionType =
  | 'generate_spark'
  | 'generate_outline'
  | 'add_character'
  | 'add_world_rule'
  | 'update_project'
  | 'navigate_to'
  | 'write_chapter_draft'

export interface HermesAction {
  type: HermesActionType
  label: string        // Human-readable label e.g. "已生成灵感设定"
  status: 'running' | 'success' | 'error'
  detail?: string      // Optional detail
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
