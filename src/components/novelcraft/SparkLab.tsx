'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import type { NovelProject, Character } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sparkles,
  Wand2,
  BookOpen,
  Users,
  Globe,
  Tag,
  ChevronRight,
  Loader2,
  Save,
  RotateCcw,
  Zap,
  Shield,
  Flame,
  Star,
} from 'lucide-react'
import { toast } from 'sonner'

// AI-generated result type
interface SparkResult {
  title: string
  synopsis: string
  goldenFinger: string
  worldBackground: string
  tags: string
  characters: {
    name: string
    role: string
    personality: string
    background: string
    conflict: string
  }[]
}

// Role badge color mapping
const ROLE_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  主角: {
    bg: 'bg-amber-500/15 border-amber-500/30',
    text: 'text-amber-400',
    icon: <Star className="size-3" />,
  },
  反派: {
    bg: 'bg-rose-500/15 border-rose-500/30',
    text: 'text-rose-400',
    icon: <Flame className="size-3" />,
  },
  配角: {
    bg: 'bg-purple-500/15 border-purple-500/30',
    text: 'text-purple-400',
    icon: <Shield className="size-3" />,
  },
}

const DEFAULT_ROLE_STYLE = {
  bg: 'bg-emerald-500/15 border-emerald-500/30',
  text: 'text-emerald-400',
  icon: <Zap className="size-3" />,
}

export default function SparkLab() {
  const {
    currentProject,
    setCurrentProject,
    setActiveTab,
    isLoading,
    setIsLoading,
    projects,
    setProjects,
  } = useAppStore()

  // Local state
  const [sparkInput, setSparkInput] = useState(currentProject?.spark || '')
  const [sparkResult, setSparkResult] = useState<SparkResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // If project already has data, pre-populate result
  const existingResult: SparkResult | null =
    currentProject && currentProject.title !== '未命名项目'
      ? {
          title: currentProject.title,
          synopsis: currentProject.synopsis || '',
          goldenFinger: currentProject.goldenFinger || '',
          worldBackground: currentProject.worldBackground || '',
          tags: currentProject.tags || '',
          characters: currentProject.characters.map((c: Character) => ({
            name: c.name,
            role: c.role,
            personality: c.personality || '',
            background: c.background || '',
            conflict: c.conflict || '',
          })),
        }
      : null

  const displayResult = sparkResult || existingResult

  // Helper: ensure a project exists before doing operations
  const ensureProject = useCallback(async (): Promise<NovelProject> => {
    if (currentProject) return currentProject

    // Auto-create a project if none exists
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spark: sparkInput.trim(), title: '未命名项目' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || '创建项目失败')
    }
    const project: NovelProject = await res.json()
    setCurrentProject(project)
    setProjects([project, ...projects])
    return project
  }, [currentProject, sparkInput, setCurrentProject, projects, setProjects])

  // Helper: update store with refreshed project data and sync projects list
  const updateStoreWithProject = useCallback((project: NovelProject) => {
    setCurrentProject(project)
    setProjects(prev => {
      const exists = prev.some(p => p.id === project.id)
      if (exists) {
        return prev.map(p => (p.id === project.id ? project : p))
      }
      return [project, ...prev]
    })
  }, [setCurrentProject, setProjects])

  // Fire the spark - call AI API (generation only, no DB save)
  const handleSpark = useCallback(async () => {
    if (!sparkInput.trim()) return

    setError(null)
    setSparkResult(null)
    setIsLoading(true)

    try {
      // Ensure we have a project before generating
      const project = await ensureProject()

      // Step 1: AI generation only (no projectId to avoid memory issues in single request)
      const res = await fetch('/api/ai/spark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spark: sparkInput.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'AI生成失败，请重试')
        return
      }

      if (data.result) {
        setSparkResult(data.result)

        // Step 2: Save the result to the project separately
        try {
          // Update project fields
          await fetch(`/api/projects/${project.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              spark: sparkInput.trim(),
              title: data.result.title,
              synopsis: data.result.synopsis,
              goldenFinger: data.result.goldenFinger,
              worldBackground: data.result.worldBackground,
              tags: data.result.tags,
            }),
          })

          // Update characters: delete old, create new
          for (const char of project.characters) {
            await fetch(`/api/characters/${char.id}`, { method: 'DELETE' })
          }
          if (data.result.characters?.length) {
            for (const char of data.result.characters) {
              await fetch(`/api/projects/${project.id}/characters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: char.name,
                  role: char.role || '主角',
                  personality: char.personality,
                  background: char.background,
                  conflict: char.conflict,
                }),
              })
            }
          }

          // Refresh project from backend
          const freshRes = await fetch(`/api/projects/${project.id}`)
          if (freshRes.ok) {
            const freshProject: NovelProject = await freshRes.json()
            updateStoreWithProject(freshProject)
          }
        } catch (saveErr) {
          // Non-critical: result is displayed locally even if save fails
          console.warn('Failed to save spark result to project:', saveErr)
          toast.warning('AI生成成功，但保存到项目失败，请手动保存')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误，请检查连接后重试')
    } finally {
      setIsLoading(false)
    }
  }, [sparkInput, ensureProject, updateStoreWithProject, setIsLoading])

  // Save project - call projects API directly (no AI re-generation)
  const handleSave = useCallback(async () => {
    if (!displayResult) return

    setIsLoading(true)
    setError(null)

    try {
      const project = await ensureProject()

      // Update existing project directly
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spark: sparkInput.trim(),
          title: displayResult.title,
          synopsis: displayResult.synopsis,
          goldenFinger: displayResult.goldenFinger,
          worldBackground: displayResult.worldBackground,
          tags: displayResult.tags,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '保存项目失败')
      }

      // Update characters: delete old, create new
      for (const char of project.characters) {
        await fetch(`/api/characters/${char.id}`, { method: 'DELETE' })
      }
      if (displayResult.characters?.length) {
        for (const char of displayResult.characters) {
          const charRes = await fetch(`/api/projects/${project.id}/characters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: char.name,
              role: char.role || '主角',
              personality: char.personality,
              background: char.background,
              conflict: char.conflict,
            }),
          })
          if (!charRes.ok) {
            console.warn('Failed to create character:', char.name)
          }
        }
      }

      // Re-fetch project to get updated data
      const freshRes = await fetch(`/api/projects/${project.id}`)
      if (freshRes.ok) {
        const freshProject: NovelProject = await freshRes.json()
        updateStoreWithProject(freshProject)
      }

      toast.success('项目已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }, [displayResult, sparkInput, ensureProject, updateStoreWithProject, setIsLoading])

  // Navigate to architecture tab
  const handleGoToArchitecture = () => {
    setActiveTab('architecture')
  }

  // Parse tags string
  const tagList = displayResult?.tags
    ? displayResult.tags.split(/[,，]/).filter((t) => t.trim())
    : []

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-8">
      {/* ===== Header ===== */}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-rose-500/10 border border-amber-500/20">
          <Sparkles className="size-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-300">灵感激发实验室</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-300 via-amber-300 to-rose-300 bg-clip-text text-transparent">
          点燃你的创作灵感
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
          输入碎片化的灵感关键词，AI 将为你生成完整的小说设定——书名、简介、金手指、世界观与核心角色
        </p>
      </div>

      {/* ===== Spark Input Section ===== */}
      <div className="relative group">
        {/* Glow effect behind the card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-amber-500/20 to-rose-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        <Card className="relative bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Wand2 className="size-5 text-purple-400" />
              <Label className="text-base font-semibold text-foreground">灵感关键词</Label>
            </div>
            <Textarea
              placeholder="输入你的灵感碎片... 例如：赛博朋克+道士 / 末世重生+基地建设 / 星际+修仙穿越"
              className="min-h-[120px] sm:min-h-[140px] text-base resize-none bg-background/50 border-border/60 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20 placeholder:text-muted-foreground/60"
              value={sparkInput}
              onChange={(e) => setSparkInput(e.target.value)}
              disabled={isLoading}
            />
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Quick suggestion chips */}
              <div className="flex flex-wrap gap-2 flex-1">
                {['赛博朋克+道士', '末世重生+系统', '星际+修仙', '宫廷+穿越'].map(
                  (hint) => (
                    <button
                      key={hint}
                      className="px-3 py-1 text-xs rounded-full border border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                      onClick={() => setSparkInput(hint)}
                      disabled={isLoading}
                      type="button"
                    >
                      {hint}
                    </button>
                  )
                )}
              </div>

              {/* Ignite button */}
              <Button
                onClick={handleSpark}
                disabled={!sparkInput.trim() || isLoading}
                className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 h-11 px-6 text-base font-semibold"
                size="lg"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-5 animate-spin" />
                    灵感迸发中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-5" />
                    点燃灵感
                  </span>
                )}
                {/* Animated shimmer */}
                {!isLoading && sparkInput.trim() && (
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Error Display ===== */}
      {error && (
        <div className="mx-auto max-w-md p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* ===== Loading Animation ===== */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="relative">
            <div className="size-16 rounded-full border-2 border-amber-500/30 animate-ping" />
            <div className="absolute inset-0 size-16 rounded-full border-2 border-purple-500/30 animate-ping [animation-delay:0.5s]" />
            <Sparkles className="absolute inset-0 m-auto size-8 text-amber-400 animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm animate-pulse">
            AI 正在为你构建世界...
          </p>
        </div>
      )}

      {/* ===== Results Display ===== */}
      {displayResult && !isLoading && (
        <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
          {/* Book Title & Synopsis */}
          <Card className="relative overflow-hidden border-border/50">
            {/* Gradient top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" />
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mt-0.5">
                  <BookOpen className="size-5 text-emerald-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground">
                    {displayResult.title}
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground leading-relaxed">
                    {displayResult.synopsis}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Golden Finger & World Background - Two column */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Golden Finger */}
            <Card className="border-border/50 bg-gradient-to-br from-amber-500/5 to-transparent">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <Zap className="size-4 text-amber-400" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-amber-300">
                    金手指
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {displayResult.goldenFinger}
                </p>
              </CardContent>
            </Card>

            {/* World Background */}
            <Card className="border-border/50 bg-gradient-to-br from-purple-500/5 to-transparent">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-purple-500/10 border border-purple-500/20">
                    <Globe className="size-4 text-purple-400" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-purple-300">
                    世界观
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {displayResult.worldBackground}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tags */}
          {tagList.length > 0 && (
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="size-4 text-emerald-400 shrink-0" />
                  <div className="flex flex-wrap gap-2">
                    {tagList.map((tag, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10"
                      >
                        {tag.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Characters */}
          {displayResult.characters && displayResult.characters.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-rose-400" />
                <h3 className="text-lg font-semibold text-foreground">核心角色</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayResult.characters.map((char, i) => {
                  const roleStyle = ROLE_STYLES[char.role] || DEFAULT_ROLE_STYLE
                  const initials = char.name.slice(0, 1)

                  return (
                    <Card
                      key={i}
                      className="relative overflow-hidden border-border/50 hover:border-border/80 transition-colors group"
                    >
                      {/* Role indicator stripe */}
                      <div
                        className={`absolute top-0 left-0 w-1 h-full ${
                          char.role === '主角'
                            ? 'bg-amber-500'
                            : char.role === '反派'
                              ? 'bg-rose-500'
                              : 'bg-purple-500'
                        }`}
                      />

                      <CardHeader className="pb-2 pl-5">
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div
                            className={`size-10 rounded-full flex items-center justify-center text-lg font-bold border ${roleStyle.bg} ${roleStyle.text}`}
                          >
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base font-semibold truncate">
                              {char.name}
                            </CardTitle>
                            <Badge
                              variant="outline"
                              className={`mt-1 text-[10px] px-1.5 py-0 ${roleStyle.bg} ${roleStyle.text} border-current/20`}
                            >
                              {roleStyle.icon}
                              {char.role}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="pl-5 space-y-2">
                        {char.personality && (
                          <div>
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                              性格
                            </span>
                            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                              {char.personality}
                            </p>
                          </div>
                        )}
                        {char.background && (
                          <div>
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                              背景
                            </span>
                            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                              {char.background}
                            </p>
                          </div>
                        )}
                        {char.conflict && char.role !== '主角' && (
                          <div className="pt-1">
                            <Separator className="!mb-2 opacity-30" />
                            <div className="flex items-start gap-1.5">
                              <Flame className="size-3.5 text-rose-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-rose-300/80 leading-relaxed">
                                {char.conflict}
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Separator */}
          <Separator className="opacity-30" />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isLoading}
              className="gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/50"
            >
              <Save className="size-4" />
              保存项目
            </Button>

            <Button
              onClick={handleGoToArchitecture}
              className="gap-2 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all"
            >
              进入架构看板
              <ChevronRight className="size-4" />
            </Button>

            <div className="flex-1" />

            <Button
              variant="ghost"
              onClick={handleSpark}
              disabled={!sparkInput.trim() || isLoading}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-4" />
              重新生成
            </Button>
          </div>
        </div>
      )}

      {/* ===== Empty State (no results yet) ===== */}
      {!displayResult && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
          <div className="relative">
            <div className="size-24 rounded-full bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-rose-500/10 border border-border/30 flex items-center justify-center">
              <Sparkles className="size-10 text-amber-400/50" />
            </div>
            {/* Orbiting dots */}
            <div className="absolute -top-1 left-1/2 size-2 rounded-full bg-emerald-400 animate-[orbit_6s_linear_infinite]" />
            <div className="absolute -bottom-1 left-1/2 size-2 rounded-full bg-rose-400 animate-[orbit_6s_linear_infinite_2s]" />
            <div className="absolute top-1/2 -right-1 size-2 rounded-full bg-purple-400 animate-[orbit_6s_linear_infinite_4s]" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-lg font-semibold text-foreground/80">等待灵感降临</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              在上方输入你的灵感碎片，组合看似不相关的元素——AI 将碰撞出意想不到的创意火花
            </p>
          </div>
          {/* Example flow */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
            <span className="px-2 py-1 rounded bg-muted/30">赛博朋克</span>
            <span>+</span>
            <span className="px-2 py-1 rounded bg-muted/30">道士</span>
            <span>=</span>
            <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400/70">?</span>
          </div>
        </div>
      )}

      {/* ===== Inline styles for custom animations ===== */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
        @keyframes orbit {
          0% {
            transform: rotate(0deg) translateX(48px) rotate(0deg);
          }
          100% {
            transform: rotate(360deg) translateX(48px) rotate(-360deg);
          }
        }
      `}</style>
    </div>
  )
}
