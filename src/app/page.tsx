'use client'

import React, { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import type { AppTab } from '@/lib/types'
import { TAB_LABELS } from '@/lib/types'

import SparkLab from '@/components/novelcraft/SparkLab'
import ArchitectureBoard from '@/components/novelcraft/ArchitectureBoard'
import OutlineEngine from '@/components/novelcraft/OutlineEngine'
import WritingSpace from '@/components/novelcraft/WritingSpace'
import HermesAgent from '@/components/novelcraft/HermesAgent'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  Sparkles,
  Shield,
  GitBranch,
  PenLine,
  ChevronDown,
  Moon,
  Sun,
  BookOpen,
  Plus,
  FolderOpen,
  Trash2,
  MessageSquare,
  X,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

// Tab config
const TABS: { key: AppTab; label: string; icon: React.ReactNode }[] = [
  { key: 'spark', label: '灵感实验室', icon: <Sparkles className="size-4" /> },
  { key: 'architecture', label: '架构看板', icon: <Shield className="size-4" /> },
  { key: 'outline', label: '大纲推演', icon: <GitBranch className="size-4" /> },
  { key: 'writing', label: '创作空间', icon: <PenLine className="size-4" /> },
]

export default function Home() {
  const {
    activeTab,
    setActiveTab,
    currentProject,
    setCurrentProject,
    projects,
    setProjects,
    focusMode,
    hermesOpen,
    setHermesOpen,
    toggleHermesOpen,
  } = useAppStore()

  const { theme, setTheme } = useTheme()

  // Track if initial load has happened
  const initialLoadDone = React.useRef(false)

  // Load projects on mount
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    async function loadProjects() {
      try {
        const res = await fetch('/api/projects')
        if (res.ok) {
          const data = await res.json()
          setProjects(data)
          // Auto-select the first project if exists
          if (data.length > 0) {
            setCurrentProject(data[0])
          }
        }
      } catch (err) {
        console.error('Failed to load projects:', err)
      }
    }
    loadProjects()
  }, [setProjects, setCurrentProject])

  // Create new project
  const handleNewProject = async () => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spark: '', title: '未命名项目' }),
      })
      if (res.ok) {
        const project = await res.json()
        setCurrentProject(project)
        setProjects([project, ...projects])
        setActiveTab('spark')
      }
    } catch (err) {
      console.error('Failed to create project:', err)
    }
  }

  // Delete project
  const handleDeleteProject = async () => {
    if (!currentProject) return
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`, { method: 'DELETE' })
      if (res.ok) {
        const remaining = projects.filter((p) => p.id !== currentProject.id)
        setProjects(remaining)
        setCurrentProject(remaining.length > 0 ? remaining[0] : null)
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  // Select project
  const handleSelectProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      setCurrentProject(project)
    }
  }

  // Render active tab content
  const renderContent = () => {
    switch (activeTab) {
      case 'spark':
        return <SparkLab />
      case 'architecture':
        return <ArchitectureBoard />
      case 'outline':
        return <OutlineEngine />
      case 'writing':
        return <WritingSpace />
    }
  }

  const isWritingFocus = activeTab === 'writing' && focusMode

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ===== Top Navigation Bar ===== */}
      {!isWritingFocus && (
        <header className="shrink-0 border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60 z-20">
          <div className="flex items-center h-14 px-4 gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-2">
              <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-500 via-amber-500 to-rose-500 flex items-center justify-center">
                <BookOpen className="size-4 text-white" />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-bold leading-tight tracking-tight">NovelCraft</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Architect Pro</span>
              </div>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Project Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 max-w-[200px] sm:max-w-[280px]">
                  <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs sm:text-sm">
                    {currentProject?.title || '选择项目'}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {projects.length > 0 ? (
                  projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => handleSelectProject(p.id)}
                      className={p.id === currentProject?.id ? 'bg-accent' : ''}
                    >
                      <BookOpen className="size-4 mr-2 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium">{p.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p.synopsis || p.spark || '无简介'}
                        </div>
                      </div>
                      {p.id === currentProject?.id && (
                        <Badge variant="secondary" className="text-[9px] ml-1 px-1">当前</Badge>
                      )}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    暂无项目
                  </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleNewProject}>
                  <Plus className="size-4 mr-2" />
                  新建项目
                </DropdownMenuItem>
                {currentProject && (
                  <DropdownMenuItem onClick={handleDeleteProject} className="text-destructive focus:text-destructive">
                    <Trash2 className="size-4 mr-2" />
                    删除当前项目
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            {/* Tab Navigation (Desktop) */}
            <nav className="hidden md:flex items-center gap-1">
              {TABS.map((tab) => (
                <Tooltip key={tab.key}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeTab === tab.key ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab(tab.key)}
                      className={`gap-1.5 text-xs transition-all ${
                        activeTab === tab.key
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.icon}
                      <span className="hidden lg:inline">{tab.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{tab.label}</TooltipContent>
                </Tooltip>
              ))}
            </nav>

            {/* Hermes Toggle (Desktop) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={hermesOpen ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={toggleHermesOpen}
                  className={cn(
                    'gap-1.5 text-xs transition-all',
                    hermesOpen
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <MessageSquare className="size-4" />
                  <span className="hidden lg:inline">Hermes</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{hermesOpen ? '关闭 Hermes' : '打开 Hermes 创作顾问'}</TooltipContent>
            </Tooltip>

            {/* Theme Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? (
                    <Sun className="size-4" />
                  ) : (
                    <Moon className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{theme === 'dark' ? '浅色模式' : '深色模式'}</TooltipContent>
            </Tooltip>

            {/* New Project Button */}
            <Button
              size="sm"
              onClick={handleNewProject}
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white text-xs"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">新建</span>
            </Button>
          </div>
        </header>
      )}

      {/* ===== Mobile Tab Bar ===== */}
      {!isWritingFocus && (
        <div className="md:hidden shrink-0 border-b bg-background/95 z-20">
          <div className="flex items-center h-11 px-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors ${
                  activeTab === tab.key
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground'
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            ))}
            {/* Hermes tab on mobile */}
            <button
              onClick={toggleHermesOpen}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors ${
                hermesOpen
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground'
              }`}
            >
              <MessageSquare className="size-4" />
              <span className="text-[10px] font-medium">Hermes</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== Main Content Area (with Hermes side panel) ===== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main content */}
        <main className={cn('flex-1 overflow-auto min-w-0', isWritingFocus ? '' : 'p-0')}>
          <div className={isWritingFocus ? 'h-full' : 'h-full'}>
            {renderContent()}
          </div>
        </main>

        {/* Hermes Side Panel */}
        <div
          className={cn(
            'shrink-0 border-l bg-background transition-all duration-300 overflow-hidden',
            'w-0 opacity-0',
            hermesOpen && !isWritingFocus && 'w-[380px] opacity-100',
            // Mobile: full overlay
            'max-md:fixed max-md:inset-0 max-md:w-full max-md:border-0 max-md:z-50',
            hermesOpen && !isWritingFocus ? 'max-md:opacity-100' : 'max-md:opacity-0 max-md:pointer-events-none'
          )}
        >
          {/* Mobile close button overlay */}
          <div className="md:hidden absolute top-2 right-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 bg-background/80 backdrop-blur-sm"
              onClick={() => setHermesOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <HermesAgent />
        </div>
      </div>

      {/* ===== Floating Hermes Button (when panel is closed) ===== */}
      {!hermesOpen && !isWritingFocus && currentProject && (
        <div className="fixed bottom-6 right-6 z-30">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleHermesOpen}
                className="size-12 rounded-full shadow-lg shadow-amber-500/20 bg-gradient-to-br from-emerald-500 to-amber-500 hover:from-emerald-600 hover:to-amber-600 text-white transition-all hover:scale-105 active:scale-95"
              >
                <MessageSquare className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">召唤 Hermes 创作顾问</TooltipContent>
          </Tooltip>
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full animate-ping bg-amber-500/20 pointer-events-none" />
        </div>
      )}

      {/* ===== Footer ===== */}
      {!isWritingFocus && (
        <footer className="shrink-0 border-t bg-background/80 backdrop-blur-sm z-10">
          <div className="flex items-center justify-between h-8 px-4 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>NovelCraft Architect Pro</span>
              {currentProject && (
                <>
                  <span className="text-border">|</span>
                  <span className="truncate max-w-[200px]">{currentProject.title}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentProject && (
                <>
                  <span>{currentProject.chapters?.length || 0} 章</span>
                  <span className="text-border">|</span>
                  <span>
                    {currentProject.chapters?.reduce((sum, c) => sum + c.wordCount, 0).toLocaleString() || 0} 字
                  </span>
                </>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
