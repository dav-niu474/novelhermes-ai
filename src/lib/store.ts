import { create } from 'zustand'
import type { NovelProject, AppTab, HermesMessage } from './types'

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
}

export const useAppStore = create<AppState>((set) => ({
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
}))
