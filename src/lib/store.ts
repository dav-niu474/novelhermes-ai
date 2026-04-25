import { create } from 'zustand'
import type { NovelProject, AppTab, HermesMessage } from './types'

// ─── Adopt Suggestion Types ─────────────────────────────────────────────────

export type AdoptTarget =
  | { type: 'project_field'; field: string; value: string }
  | { type: 'character'; character: { name: string; role: string; personality: string; background: string; conflict: string } }
  | { type: 'world_rule'; rule: { category: string; title: string; content: string } }
  | { type: 'chapter_content'; chapterId: string; content: string; mode: 'append' | 'replace' }
  | { type: 'spark'; spark: string }

interface AppState {
  // 当前活跃Tab
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void

  // 当前项目
  currentProject: NovelProject | null
  setCurrentProject: (project: NovelProject | null) => void

  // 项目列表
  projects: NovelProject[]
  setProjects: (projects: NovelProject[]) => void

  // 加载状态
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // 专注模式 (写作空间)
  focusMode: boolean
  toggleFocusMode: () => void

  // 当前编辑的章节ID
  activeChapterId: string | null
  setActiveChapterId: (id: string | null) => void

  // 更新项目局部数据
  updateProjectData: (data: Partial<NovelProject>) => void

  // Hermes Agent
  hermesOpen: boolean
  setHermesOpen: (open: boolean) => void
  toggleHermesOpen: () => void
  hermesMessages: HermesMessage[]
  addHermesMessage: (message: HermesMessage) => void
  clearHermesMessages: () => void
  hermesLoading: boolean
  setHermesLoading: (loading: boolean) => void
  /** Refresh current project from backend */
  refreshProject: () => Promise<void>

  // Adopt suggestion mechanism (Hermes → Left Panel)
  pendingAdopt: AdoptTarget | null
  setPendingAdopt: (target: AdoptTarget | null) => void
  /** Consume and clear the pending adopt, returning it */
  consumeAdopt: () => AdoptTarget | null
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'spark',
  setActiveTab: (tab) => set({ activeTab: tab }),

  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),

  projects: [],
  setProjects: (projects) => set({ projects }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  focusMode: false,
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

  activeChapterId: null,
  setActiveChapterId: (id) => set({ activeChapterId: id }),

  updateProjectData: (data) =>
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, ...data }
        : null,
    })),

  // Hermes Agent state
  hermesOpen: false,
  setHermesOpen: (open) => set({ hermesOpen: open }),
  toggleHermesOpen: () => set((state) => ({ hermesOpen: !state.hermesOpen })),
  hermesMessages: [],
  addHermesMessage: (message) =>
    set((state) => ({ hermesMessages: [...state.hermesMessages, message] })),
  clearHermesMessages: () => set({ hermesMessages: [] }),
  hermesLoading: false,
  setHermesLoading: (loading) => set({ hermesLoading: loading }),

  refreshProject: async () => {
    const { currentProject } = get()
    if (!currentProject) return
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`)
      if (res.ok) {
        const fresh = await res.json()
        set({ currentProject: fresh })
        // Also update in projects list
        const { projects } = get()
        set({
          projects: projects.map((p) => (p.id === fresh.id ? fresh : p)),
        })
      }
    } catch (err) {
      console.error('Failed to refresh project:', err)
    }
  },

  // Adopt mechanism
  pendingAdopt: null,
  setPendingAdopt: (target) => set({ pendingAdopt: target }),
  consumeAdopt: () => {
    const { pendingAdopt } = get()
    set({ pendingAdopt: null })
    return pendingAdopt
  },
}))
