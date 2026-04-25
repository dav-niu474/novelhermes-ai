'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import type { Chapter, BeatType, Unit } from '@/lib/types'
import { BEAT_TYPE_LABELS } from '@/lib/types'
import type { WritingStep } from '@/lib/store'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

import {
  FileText,
  BookOpen,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
  PenLine,
  Eye,
  Loader2,
  BookMarked,
  Globe,
  Sparkles,
  ListTree,
  PanelLeftOpen,
  Wand2,
  MessageCircle,
  Lightbulb,
  Copy,
  RotateCcw,
  Plus,
  ArrowRight,
  ArrowLeft,
  Pencil,
  Layers,
  GitBranch,
  Target,
  CheckCircle2,
  Circle,
  Play,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  if (!text || text.trim() === '') return 0
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const englishWords = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0).length
  return chineseChars + englishWords
}

function formatWordCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return n.toLocaleString()
}

function parsePlotPoints(plotPoints: string | null): string[] {
  if (!plotPoints) return []
  try {
    const parsed = JSON.parse(plotPoints)
    if (Array.isArray(parsed)) return parsed.map(String)
    return []
  } catch {
    return []
  }
}

// ─── Beat Color Mapping ──────────────────────────────────────────────────────

const BEAT_DOT_COLORS: Record<BeatType, string> = {
  opening: 'bg-emerald-500',
  conflict: 'bg-rose-500',
  turn: 'bg-amber-500',
  suspense: 'bg-purple-500',
}

const BEAT_BG_COLORS: Record<BeatType, string> = {
  opening: 'bg-emerald-500/10 border-emerald-500/20',
  conflict: 'bg-rose-500/10 border-rose-500/20',
  turn: 'bg-amber-500/10 border-amber-500/20',
  suspense: 'bg-purple-500/10 border-purple-500/20',
}

const BEAT_TEXT_COLORS: Record<BeatType, string> = {
  opening: 'text-emerald-600 dark:text-emerald-400',
  conflict: 'text-rose-600 dark:text-rose-400',
  turn: 'text-amber-600 dark:text-amber-400',
  suspense: 'text-purple-600 dark:text-purple-400',
}

// ─── Types ───────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type AIAssistMode = 'continue' | 'rewrite' | 'suggest' | 'dialogue'

interface SuggestionItem {
  title: string
  desc: string
}

interface UnitWithMeta extends Unit {
  volumeTitle: string
  stageTitle: string
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

const STEPS: { key: WritingStep; label: string; icon: React.ElementType }[] = [
  { key: 'select_unit', label: '选择单元', icon: Layers },
  { key: 'plan_chapters', label: '规划章节', icon: GitBranch },
  { key: 'plot_points', label: '剧情要点', icon: Target },
  { key: 'write', label: '开始写作', icon: PenLine },
]

function StepIndicator({
  currentStep,
  onStepClick,
}: {
  currentStep: WritingStep
  onStepClick: (step: WritingStep) => void
}) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <div className="flex items-center gap-1 px-4 py-2.5 border-b bg-background/95 backdrop-blur-sm shrink-0">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isActive = index === currentIndex
        const isPending = index > currentIndex
        const Icon = step.icon

        return (
          <React.Fragment key={step.key}>
            {index > 0 && (
              <div
                className={cn(
                  'h-px flex-1 min-w-[16px] max-w-[40px]',
                  isCompleted ? 'bg-emerald-500' : 'bg-border'
                )}
              />
            )}
            <button
              onClick={() => {
                if (isCompleted || isActive) onStepClick(step.key)
              }}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-xs font-medium',
                isActive && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
                isCompleted && 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5 cursor-pointer',
                isPending && 'text-muted-foreground/50 cursor-default'
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="size-3.5" />
              ) : isActive ? (
                <Icon className="size-3.5" />
              ) : (
                <Circle className="size-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Step 1: Unit Selector ───────────────────────────────────────────────────

function UnitSelector({
  onSelectUnit,
}: {
  onSelectUnit: (unitId: string) => void
}) {
  const { currentProject } = useAppStore()

  // Flatten all units with their parent volume/stage info
  const unitsWithMeta = useMemo<UnitWithMeta[]>(() => {
    if (!currentProject) return []
    const result: UnitWithMeta[] = []
    for (const volume of currentProject.volumes) {
      for (const stage of volume.stages) {
        for (const unit of stage.units) {
          result.push({
            ...unit,
            volumeTitle: volume.title,
            stageTitle: stage.title,
          })
        }
      }
    }
    return result
  }, [currentProject])

  // Group units by volume > stage
  const groupedUnits = useMemo(() => {
    const groups: { volumeTitle: string; stages: { stageTitle: string; units: UnitWithMeta[] }[] }[] = []
    for (const unit of unitsWithMeta) {
      let volumeGroup = groups.find((g) => g.volumeTitle === unit.volumeTitle)
      if (!volumeGroup) {
        volumeGroup = { volumeTitle: unit.volumeTitle, stages: [] }
        groups.push(volumeGroup)
      }
      let stageGroup = volumeGroup.stages.find((s) => s.stageTitle === unit.stageTitle)
      if (!stageGroup) {
        stageGroup = { stageTitle: unit.stageTitle, units: [] }
        volumeGroup.stages.push(stageGroup)
      }
      stageGroup.units.push(unit)
    }
    return groups
  }, [unitsWithMeta])

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <BookOpen className="size-8 opacity-40" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">尚未选择项目</h3>
        <p className="text-sm text-center max-w-xs">
          请先在灵感实验室创建或选择一个项目
        </p>
      </div>
    )
  }

  if (unitsWithMeta.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Layers className="size-8 opacity-40" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">暂无创作单元</h3>
        <p className="text-sm text-center max-w-xs">
          请先在大纲推演中生成大纲，创建卷→阶段→单元结构
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-xl font-bold text-foreground mb-1">选择创作单元</h2>
          <p className="text-sm text-muted-foreground">
            选择一个单元开始创作，每个单元包含若干章节
          </p>
        </motion.div>

        <div className="space-y-6">
          {groupedUnits.map((volumeGroup) => (
            <motion.div
              key={volumeGroup.volumeTitle}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="size-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold text-foreground">{volumeGroup.volumeTitle}</h3>
              </div>

              <div className="space-y-4 ml-2">
                {volumeGroup.stages.map((stageGroup) => (
                  <div key={stageGroup.stageTitle}>
                    <div className="flex items-center gap-2 mb-2 ml-2">
                      <GitBranch className="size-3.5 text-amber-600 dark:text-amber-400" />
                      <h4 className="text-xs font-medium text-muted-foreground">{stageGroup.stageTitle}</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ml-4">
                      {stageGroup.units.map((unit) => {
                        const chapterCount = unit.chapters.length
                        const completedCount = unit.chapters.filter((c) => c.status === 'completed').length
                        const totalWords = unit.chapters.reduce((sum, c) => sum + c.wordCount, 0)
                        const progress = chapterCount > 0 ? Math.round((completedCount / chapterCount) * 100) : 0

                        return (
                          <Card
                            key={unit.id}
                            className="group cursor-pointer transition-all hover:shadow-md hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] dark:hover:bg-emerald-500/[0.04]"
                            onClick={() => onSelectUnit(unit.id)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h5 className="text-sm font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                                  {unit.title || '未命名单元'}
                                </h5>
                                {progress === 100 && (
                                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0">
                                    已完成
                                  </Badge>
                                )}
                              </div>

                              {unit.summary && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                                  {unit.summary}
                                </p>
                              )}

                              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <FileText className="size-3" />
                                  {chapterCount}章
                                </span>
                                <span className="flex items-center gap-1">
                                  <PenLine className="size-3" />
                                  {formatWordCount(totalWords)}字
                                </span>
                                {chapterCount > 0 && progress < 100 && (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    {progress}%
                                  </span>
                                )}
                              </div>

                              {chapterCount > 0 && progress < 100 && (
                                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}

// ─── Step 2: Chapter Planner ─────────────────────────────────────────────────

function ChapterPlanner({
  unitId,
  onNext,
  onBack,
}: {
  unitId: string
  onNext: () => void
  onBack: () => void
}) {
  const { currentProject, refreshProject } = useAppStore()
  const [aiPlanning, setAiPlanning] = useState(false)
  const [addingChapter, setAddingChapter] = useState(false)
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSummary, setEditSummary] = useState('')

  // Find the active unit from project data
  const activeUnit = useMemo(() => {
    if (!currentProject) return null
    for (const volume of currentProject.volumes) {
      for (const stage of volume.stages) {
        for (const unit of stage.units) {
          if (unit.id === unitId) return unit
        }
      }
    }
    return null
  }, [currentProject, unitId])

  const sortedChapters = useMemo(
    () => activeUnit ? [...activeUnit.chapters].sort((a, b) => a.order - b.order) : [],
    [activeUnit]
  )

  const handleAIPlan = useCallback(async () => {
    if (!currentProject) return
    setAiPlanning(true)
    try {
      const res = await fetch('/api/ai/unit-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId, projectId: currentProject.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'AI规划失败')
        return
      }
      if (data.project) {
        useAppStore.getState().setCurrentProject(data.project)
      } else {
        await refreshProject()
      }
      toast.success('AI章节规划完成')
    } catch (err) {
      toast.error('AI规划请求失败')
      console.error('AI unit plan error:', err)
    } finally {
      setAiPlanning(false)
    }
  }, [currentProject, unitId, refreshProject])

  const handleAddChapter = useCallback(async () => {
    if (!newChapterTitle.trim()) {
      toast.error('请输入章节标题')
      return
    }
    setAddingChapter(true)
    try {
      const res = await fetch(`/api/units/${unitId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newChapterTitle.trim(), projectId: currentProject?.id }),
      })
      if (!res.ok) throw new Error('Failed to add chapter')
      await refreshProject()
      setNewChapterTitle('')
      toast.success('章节已添加')
    } catch (err) {
      toast.error('添加章节失败')
      console.error('Add chapter error:', err)
    } finally {
      setAddingChapter(false)
    }
  }, [unitId, newChapterTitle, currentProject, refreshProject])

  const handleSaveChapter = useCallback(async (chapterId: string, data: { title?: string; summary?: string }) => {
    try {
      const res = await fetch(`/api/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update chapter')
      await refreshProject()
      setEditingChapterId(null)
      toast.success('章节已更新')
    } catch (err) {
      toast.error('更新章节失败')
      console.error('Update chapter error:', err)
    }
  }, [refreshProject])

  const startEditing = useCallback((chapter: Chapter) => {
    setEditingChapterId(chapter.id)
    setEditTitle(chapter.title)
    setEditSummary(chapter.summary || '')
  }, [])

  if (!activeUnit) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <p className="text-sm">未找到单元信息</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-xl font-bold text-foreground mb-1">{activeUnit.title}</h2>
          {activeUnit.summary && (
            <p className="text-sm text-muted-foreground">{activeUnit.summary}</p>
          )}
        </motion.div>

        {/* AI Plan Button */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            onClick={handleAIPlan}
            disabled={aiPlanning}
            className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white"
          >
            {aiPlanning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            AI规划章节
          </Button>
          <span className="text-xs text-muted-foreground">
            AI 将根据单元信息和项目设定自动生成章节规划
          </span>
        </div>

        {/* Manual Add */}
        <div className="flex items-center gap-2 mb-6">
          <Input
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
            placeholder="输入章节标题手动添加..."
            className="flex-1 h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddChapter()
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddChapter}
            disabled={addingChapter || !newChapterTitle.trim()}
            className="gap-1.5"
          >
            {addingChapter ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            添加
          </Button>
        </div>

        {/* Chapter List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sortedChapters.map((chapter, index) => (
              <motion.div
                key={chapter.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: index * 0.05 }}
              >
                {editingChapterId === chapter.id ? (
                  <Card className="border-emerald-500/30 bg-emerald-500/[0.02]">
                    <CardContent className="p-4 space-y-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="章节标题"
                        className="h-8 text-sm"
                      />
                      <Textarea
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                        placeholder="章节摘要（可选）"
                        className="min-h-[60px] text-sm resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveChapter(chapter.id, { title: editTitle, summary: editSummary })}
                          className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="size-3" />保存
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingChapterId(null)}
                          className="h-7 text-xs"
                        >
                          取消
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="group hover:shadow-sm transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-mono text-muted-foreground/50 mt-0.5 w-6 shrink-0 text-center">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-foreground truncate">
                              {chapter.title || '未命名章节'}
                            </h4>
                            {chapter.status === 'completed' && (
                              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shrink-0">
                                已完成
                              </Badge>
                            )}
                            {chapter.status === 'planned' && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                                规划中
                              </Badge>
                            )}
                          </div>
                          {chapter.summary && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {chapter.summary}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                            <span>{formatWordCount(chapter.wordCount)}字</span>
                            {chapter.plotPoints && (
                              <span className="text-purple-600 dark:text-purple-400">
                                {parsePlotPoints(chapter.plotPoints).length}个要点
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => startEditing(chapter)}
                        >
                          <Pencil className="size-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {sortedChapters.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-2">暂无章节</p>
              <p className="text-xs">点击「AI规划章节」自动生成，或手动添加章节</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t">
          <Button variant="outline" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="size-4" />
            返回选择
          </Button>
          <Button
            onClick={onNext}
            disabled={sortedChapters.length === 0}
            className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white"
          >
            下一步：剧情要点
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}

// ─── Step 3: Plot Point Editor ───────────────────────────────────────────────

function PlotPointEditor({
  unitId,
  onNext,
  onBack,
}: {
  unitId: string
  onNext: () => void
  onBack: () => void
}) {
  const { currentProject, refreshProject } = useAppStore()
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editPoints, setEditPoints] = useState<string[]>([])

  const activeUnit = useMemo(() => {
    if (!currentProject) return null
    for (const volume of currentProject.volumes) {
      for (const stage of volume.stages) {
        for (const unit of stage.units) {
          if (unit.id === unitId) return unit
        }
      }
    }
    return null
  }, [currentProject, unitId])

  const sortedChapters = useMemo(
    () => activeUnit ? [...activeUnit.chapters].sort((a, b) => a.order - b.order) : [],
    [activeUnit]
  )

  const startEditing = useCallback((chapter: Chapter) => {
    setEditingChapterId(chapter.id)
    setEditPoints(parsePlotPoints(chapter.plotPoints))
  }, [])

  const addPoint = useCallback(() => {
    setEditPoints((prev) => [...prev, ''])
  }, [])

  const updatePoint = useCallback((index: number, value: string) => {
    setEditPoints((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }, [])

  const removePoint = useCallback((index: number) => {
    setEditPoints((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const savePoints = useCallback(async (chapterId: string) => {
    const filtered = editPoints.filter((p) => p.trim() !== '')
    try {
      const res = await fetch(`/api/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plotPoints: JSON.stringify(filtered) }),
      })
      if (!res.ok) throw new Error('Failed to save plot points')
      await refreshProject()
      setEditingChapterId(null)
      toast.success('剧情要点已保存')
    } catch (err) {
      toast.error('保存剧情要点失败')
      console.error('Save plot points error:', err)
    }
  }, [editPoints, refreshProject])

  // AI Generate plot points for a chapter
  const [aiGeneratingId, setAiGeneratingId] = useState<string | null>(null)

  const handleAIGenerate = useCallback(async (chapter: Chapter) => {
    if (!currentProject) return
    setAiGeneratingId(chapter.id)
    try {
      const res = await fetch('/api/ai/writing-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          chapterId: chapter.id,
          mode: 'suggest',
          content: chapter.summary || chapter.title,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'AI生成要点失败')
        return
      }
      // Parse suggestions into plot points
      const result = data.result || ''
      const points = result.split('\n').filter((l: string) => l.trim()).map((l: string) => l.replace(/^\d+[\.\、\)]\s*/, '').trim())
      if (points.length > 0) {
        await fetch(`/api/chapters/${chapter.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plotPoints: JSON.stringify(points) }),
        })
        await refreshProject()
        toast.success('AI已生成剧情要点')
      } else {
        toast.info('AI未返回有效要点，请手动编辑')
      }
    } catch (err) {
      toast.error('AI生成请求失败')
      console.error('AI generate plot points error:', err)
    } finally {
      setAiGeneratingId(null)
    }
  }, [currentProject, refreshProject])

  if (!activeUnit) return null

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-xl font-bold text-foreground mb-1">剧情要点</h2>
          <p className="text-sm text-muted-foreground">
            为每个章节设定剧情要点，引导写作方向
          </p>
        </motion.div>

        <div className="space-y-4">
          {sortedChapters.map((chapter, index) => {
            const points = parsePlotPoints(chapter.plotPoints)
            const isEditing = editingChapterId === chapter.id
            const isAiGenerating = aiGeneratingId === chapter.id

            return (
              <motion.div
                key={chapter.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={cn(
                  'transition-all',
                  isEditing && 'border-emerald-500/30 bg-emerald-500/[0.02]'
                )}>
                  <CardContent className="p-4">
                    {/* Chapter Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-mono text-muted-foreground/50 w-6 shrink-0 text-center">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <h4 className="text-sm font-medium text-foreground flex-1 truncate">
                        {chapter.title || '未命名章节'}
                      </h4>
                      {!isEditing && points.length === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAIGenerate(chapter)}
                          disabled={isAiGenerating}
                          className="h-6 text-[11px] gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-700"
                        >
                          {isAiGenerating ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Sparkles className="size-3" />
                          )}
                          AI生成要点
                        </Button>
                      )}
                      {!isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(chapter)}
                          className="h-6 text-[11px] gap-1"
                        >
                          <Pencil className="size-3" />
                          编辑
                        </Button>
                      )}
                    </div>

                    {/* Plot Points Display / Edit */}
                    {isEditing ? (
                      <div className="space-y-2 ml-8">
                        {editPoints.map((point, pIndex) => (
                          <div key={pIndex} className="flex items-start gap-2">
                            <span className="text-xs text-muted-foreground mt-2 w-4 shrink-0 text-center">
                              {pIndex + 1}.
                            </span>
                            <Textarea
                              value={point}
                              onChange={(e) => updatePoint(pIndex, e.target.value)}
                              placeholder="输入剧情要点..."
                              className="min-h-[40px] text-xs resize-none flex-1"
                              rows={1}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 shrink-0 mt-1"
                              onClick={() => removePoint(pIndex)}
                            >
                              <RotateCcw className="size-3 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={addPoint}
                          className="h-6 text-[11px] gap-1 ml-6"
                        >
                          <Plus className="size-3" />
                          添加要点
                        </Button>
                        <div className="flex items-center gap-2 ml-6 mt-2">
                          <Button
                            size="sm"
                            onClick={() => savePoints(chapter.id)}
                            className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Check className="size-3" />保存
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingChapterId(null)}
                            className="h-7 text-xs"
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : points.length > 0 ? (
                      <div className="ml-8 space-y-1.5">
                        {points.map((point, pIndex) => (
                          <div
                            key={pIndex}
                            className="flex items-start gap-2 text-xs"
                          >
                            <span className="inline-block size-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                            <span className="text-muted-foreground leading-relaxed">{point}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ml-8 text-xs text-muted-foreground/60 italic">
                        暂无剧情要点
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t">
          <Button variant="outline" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="size-4" />
            返回章节规划
          </Button>
          <Button
            onClick={onNext}
            className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white"
          >
            <Play className="size-4" />
            开始写作
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}

// ─── Step 4: Writing Editor ──────────────────────────────────────────────────

function WritingEditor({
  unitId,
  onBack,
}: {
  unitId: string
  onBack: () => void
}) {
  const {
    currentProject,
    activeChapterId,
    setActiveChapterId,
    focusMode,
    toggleFocusMode,
    pendingAdopt,
    consumeAdopt,
    refreshProject,
  } = useAppStore()

  const isMobile = useIsMobile()

  // Local editing state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // AI assist state
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<SuggestionItem[] | null>(null)
  const [aiMode, setAiMode] = useState<AIAssistMode | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false)

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContentRef = useRef<string>('')
  const lastSavedTitleRef = useRef<string>('')

  // Find active unit's chapters
  const activeUnit = useMemo(() => {
    if (!currentProject) return null
    for (const volume of currentProject.volumes) {
      for (const stage of volume.stages) {
        for (const unit of stage.units) {
          if (unit.id === unitId) return unit
        }
      }
    }
    return null
  }, [currentProject, unitId])

  const chapters = useMemo(() => activeUnit?.chapters ?? [], [activeUnit])
  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters]
  )

  const activeChapter = useMemo(
    () => chapters.find((c) => c.id === activeChapterId) ?? null,
    [chapters, activeChapterId]
  )

  const currentChapterIndex = useMemo(
    () => sortedChapters.findIndex((c) => c.id === activeChapterId),
    [sortedChapters, activeChapterId]
  )

  const wordCount = useMemo(() => countWords(content), [content])
  const totalWordCount = useMemo(
    () => chapters.reduce((sum, c) => sum + c.wordCount, 0),
    [chapters]
  )

  // ─── Handle adopt from Hermes ────────────────────────────────────────────

  useEffect(() => {
    if (!pendingAdopt) return
    if (pendingAdopt.type === 'chapter_content' && pendingAdopt.chapterId === activeChapterId) {
      if (pendingAdopt.mode === 'append') {
        setContent((prev) => prev + '\n' + pendingAdopt.content)
        toast.success('AI内容已采纳并追加')
      } else {
        setContent(pendingAdopt.content)
        toast.success('AI内容已采纳')
      }
      consumeAdopt()
    }
  }, [pendingAdopt, activeChapterId, consumeAdopt])

  // ─── Sync local state when active chapter changes ────────────────────────

  useEffect(() => {
    if (activeChapter) {
      setTitle(activeChapter.title || '')
      setContent(activeChapter.content || '')
      lastSavedContentRef.current = activeChapter.content || ''
      lastSavedTitleRef.current = activeChapter.title || ''
    } else {
      setTitle('')
      setContent('')
      lastSavedContentRef.current = ''
      lastSavedTitleRef.current = ''
    }
    setSaveStatus('idle')
    setAiResult(null)
    setAiSuggestions(null)
    setAiMode(null)
  }, [activeChapterId])

  // ─── Auto-select first chapter ───────────────────────────────────────────

  useEffect(() => {
    if (chapters.length > 0 && !activeChapterId) {
      setActiveChapterId(sortedChapters[0].id)
    } else if (chapters.length > 0 && !chapters.find((c) => c.id === activeChapterId)) {
      setActiveChapterId(sortedChapters[0].id)
    }
  }, [chapters, activeChapterId, sortedChapters, setActiveChapterId])

  // ─── Save chapter to API ─────────────────────────────────────────────────

  const saveChapter = useCallback(
    async (chapterId: string, data: { title?: string; content?: string; wordCount?: number; status?: string }) => {
      setSaveStatus('saving')
      try {
        const res = await fetch(`/api/chapters/${chapterId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Save failed')
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000)
      } catch {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    },
    []
  )

  // ─── Debounced auto-save ─────────────────────────────────────────────────

  const debouncedSave = useCallback(
    (chapterId: string, newTitle: string, newContent: string, newWordCount: number, status: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveChapter(chapterId, { title: newTitle, content: newContent, wordCount: newWordCount, status })
        lastSavedContentRef.current = newContent
        lastSavedTitleRef.current = newTitle
      }, 1000)
    },
    [saveChapter]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ─── Get selected text ───────────────────────────────────────────────────

  const getSelectedText = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return ''
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    if (start === end) return ''
    return content.substring(start, end)
  }, [content])

  // ─── AI Assist ───────────────────────────────────────────────────────────

  const callAIAssist = useCallback(async (mode: AIAssistMode) => {
    if (!currentProject || !activeChapterId) return
    const selText = getSelectedText()

    if (mode === 'rewrite' && !selText) {
      toast.error('请先选择要改写的文本')
      return
    }

    setAiLoading(true)
    setAiMode(mode)
    setAiResult(null)
    setAiSuggestions(null)
    setAiPopoverOpen(false)

    try {
      const res = await fetch('/api/ai/writing-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          chapterId: activeChapterId,
          mode,
          content,
          selectedText: selText || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'AI辅助失败')
        return
      }

      if (data.suggestions) setAiSuggestions(data.suggestions)
      setAiResult(data.result)
    } catch (err) {
      toast.error('AI辅助请求失败')
      console.error('AI assist error:', err)
    } finally {
      setAiLoading(false)
    }
  }, [currentProject, activeChapterId, content, getSelectedText])

  // ─── Apply AI result ─────────────────────────────────────────────────────

  const handleApplyAI = useCallback(() => {
    if (!aiResult) return

    let newContent: string
    if (aiMode === 'rewrite' && selectedText) {
      const textarea = textareaRef.current
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        newContent = content.substring(0, start) + aiResult + content.substring(end)
      } else {
        newContent = content
      }
    } else {
      newContent = content + '\n' + aiResult
    }

    setContent(newContent)
    const newWordCount = countWords(newContent)
    if (activeChapterId && activeChapter) {
      debouncedSave(activeChapterId, title, newContent, newWordCount, activeChapter.status)
    }

    setAiResult(null)
    setAiSuggestions(null)
    setAiMode(null)
    setSelectedText('')
    toast.success('AI内容已采纳')
  }, [aiResult, aiMode, selectedText, content, title, activeChapterId, activeChapter, debouncedSave])

  const handleDiscardAI = useCallback(() => {
    setAiResult(null)
    setAiSuggestions(null)
    setAiMode(null)
    setSelectedText('')
  }, [])

  // ─── Content / Title change ──────────────────────────────────────────────

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value
      setContent(newContent)
      if (activeChapterId && activeChapter) {
        debouncedSave(activeChapterId, title, newContent, countWords(newContent), activeChapter.status)
      }
    },
    [activeChapterId, activeChapter, title, debouncedSave]
  )

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value
      setTitle(newTitle)
      if (activeChapterId && activeChapter) {
        debouncedSave(activeChapterId, newTitle, content, activeChapter.wordCount, activeChapter.status)
      }
    },
    [activeChapterId, activeChapter, content, debouncedSave]
  )

  // ─── Status toggle ───────────────────────────────────────────────────────

  const handleStatusToggle = useCallback(() => {
    if (!activeChapterId || !activeChapter) return
    const newStatus = activeChapter.status === 'completed' ? 'draft' : 'completed'
    saveChapter(activeChapterId, { title, content, wordCount, status: newStatus })
    refreshProject()
  }, [activeChapterId, activeChapter, title, content, wordCount, saveChapter, refreshProject])

  // ─── Chapter navigation ──────────────────────────────────────────────────

  const goToPrevChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        if (activeChapterId && activeChapter) {
          saveChapter(activeChapterId, { title, content, wordCount, status: activeChapter.status })
        }
      }
      setActiveChapterId(sortedChapters[currentChapterIndex - 1].id)
    }
  }, [currentChapterIndex, sortedChapters, activeChapterId, activeChapter, title, content, wordCount, saveChapter, setActiveChapterId])

  const goToNextChapter = useCallback(() => {
    if (currentChapterIndex < sortedChapters.length - 1) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        if (activeChapterId && activeChapter) {
          saveChapter(activeChapterId, { title, content, wordCount, status: activeChapter.status })
        }
      }
      setActiveChapterId(sortedChapters[currentChapterIndex + 1].id)
    }
  }, [currentChapterIndex, sortedChapters, activeChapterId, activeChapter, title, content, wordCount, saveChapter, setActiveChapterId])

  const handleSelectChapter = useCallback(
    (id: string) => {
      if (id === activeChapterId) return
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        if (activeChapterId && activeChapter) {
          saveChapter(activeChapterId, { title, content, wordCount, status: activeChapter.status })
        }
      }
      setActiveChapterId(id)
      setMobileDrawerOpen(false)
    },
    [activeChapterId, activeChapter, title, content, wordCount, saveChapter, setActiveChapterId]
  )

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        if (activeChapterId && activeChapter) {
          saveChapter(activeChapterId, { title, content, wordCount, status: activeChapter.status })
          lastSavedContentRef.current = content
          lastSavedTitleRef.current = title
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeChapterId, activeChapter, title, content, wordCount, saveChapter])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) toggleFocusMode()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [focusMode, toggleFocusMode])

  // ─── Save status indicator ───────────────────────────────────────────────

  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <Loader2 className="size-3 animate-spin" />保存中...
          </span>
        )
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="size-3" />已保存
          </span>
        )
      case 'error':
        return (
          <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
            <Save className="size-3" />保存失败
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <PenLine className="size-3" />未修改
          </span>
        )
    }
  }

  // ─── Left Sidebar: Chapter Directory ─────────────────────────────────────

  const leftSidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center gap-2 border-b">
        <ListTree className="size-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-semibold text-foreground">章节目录</h3>
        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
          {chapters.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {sortedChapters.map((chapter, index) => {
            const isActive = chapter.id === activeChapterId
            return (
              <button
                key={chapter.id}
                onClick={() => handleSelectChapter(chapter.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group',
                  'hover:bg-accent/60',
                  isActive
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'border border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      'text-[10px] font-mono mt-1 w-5 shrink-0 text-center',
                      isActive ? 'text-emerald-500' : 'text-muted-foreground/50'
                    )}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-sm truncate leading-tight',
                        isActive ? 'font-medium' : 'font-normal'
                      )}
                    >
                      {chapter.title || '未命名章节'}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {formatWordCount(chapter.wordCount)}字
                      </span>
                      {chapter.status === 'completed' && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-3.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        >
                          已完成
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )

  // ─── Right Sidebar: Chapter Reference ────────────────────────────────────

  const plotPoints = useMemo(() => parsePlotPoints(activeChapter?.plotPoints ?? null), [activeChapter])

  const rightSidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center gap-2 border-b">
        <Eye className="size-4 text-purple-600 dark:text-purple-400" />
        <h3 className="text-sm font-semibold text-foreground">写作参考</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Plot Points */}
          {plotPoints.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="size-3.5 text-purple-500" />
                <span className="text-xs font-medium text-foreground">剧情要点</span>
              </div>
              <div className="space-y-1.5">
                {plotPoints.map((point, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-purple-500/20 bg-purple-500/5 px-2.5 py-2"
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="inline-block size-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{point}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chapter Summary */}
          {activeChapter?.summary && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookMarked className="size-3.5 text-amber-500" />
                <span className="text-xs font-medium text-foreground">章节摘要</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed bg-amber-500/5 border border-amber-500/10 rounded-md p-2.5">
                {activeChapter.summary}
              </p>
            </div>
          )}

          {/* Story Beats */}
          {activeChapter && activeChapter.storyBeats.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="size-3.5 text-purple-500" />
                <span className="text-xs font-medium text-foreground">故事节拍</span>
              </div>
              <div className="space-y-1.5">
                {activeChapter.storyBeats.map((beat) => {
                  const beatType = beat.type as BeatType
                  return (
                    <div
                      key={beat.id}
                      className={cn('rounded-md border px-2.5 py-2', BEAT_BG_COLORS[beatType])}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn('inline-block size-1.5 rounded-full', BEAT_DOT_COLORS[beatType])} />
                        <span className={cn('text-[10px] font-medium', BEAT_TEXT_COLORS[beatType])}>
                          {BEAT_TYPE_LABELS[beatType] || beat.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{beat.content}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Golden Finger */}
          {currentProject?.goldenFinger && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-foreground">金手指</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed bg-amber-500/5 border border-amber-500/10 rounded-md p-2.5">
                  {currentProject.goldenFinger}
                </p>
              </div>
            </>
          )}

          {/* World Rules */}
          {currentProject && currentProject.worldRules.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Globe className="size-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-foreground">世界规则</span>
              </div>
              <div className="space-y-1.5">
                {currentProject.worldRules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="text-xs bg-emerald-500/5 border border-emerald-500/10 rounded-md px-2.5 py-2"
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 h-3.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      >
                        {rule.category}
                      </Badge>
                      <span className="font-medium text-foreground">{rule.title}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{rule.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!plotPoints.length && !activeChapter?.summary && (!activeChapter?.storyBeats.length) && !currentProject?.goldenFinger && (!currentProject?.worldRules.length) && (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="size-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">暂无参考信息</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )

  // ─── AI Assist Panel ─────────────────────────────────────────────────────

  const aiPanel = (aiResult || aiLoading) && (
    <div className="border-t bg-muted/30 shrink-0">
      <div className="px-4 py-2 flex items-center gap-2 border-b bg-background/80">
        <Wand2 className="size-3.5 text-emerald-500" />
        <span className="text-xs font-medium text-foreground">
          {aiMode === 'continue' ? 'AI 续写' :
           aiMode === 'rewrite' ? 'AI 改写' :
           aiMode === 'suggest' ? 'AI 建议' :
           aiMode === 'dialogue' ? 'AI 对话' : 'AI 辅助'}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {aiResult && !aiLoading && (
            <>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-muted-foreground" onClick={handleDiscardAI}>
                <RotateCcw className="size-3" />放弃
              </Button>
              <Button size="sm" className="h-6 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApplyAI}>
                <Check className="size-3" />
                {aiMode === 'rewrite' ? '替换选区' : aiMode === 'suggest' ? '采纳并续写' : '采纳'}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="max-h-[250px] overflow-y-auto px-4 py-3">
        {aiLoading ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 className="size-4 animate-spin text-emerald-500" />
            <span className="text-xs text-muted-foreground">AI 正在创作中...</span>
          </div>
        ) : aiSuggestions && aiSuggestions.length > 0 ? (
          <div className="space-y-2">
            {aiSuggestions.map((s, i) => (
              <div key={i} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
              </div>
            ))}
          </div>
        ) : aiResult ? (
          <div
            className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-serif"
            style={{ fontFamily: '"Noto Serif SC", "Source Han Serif CN", "STSong", Georgia, serif' }}
          >
            {aiResult}
          </div>
        ) : null}
      </div>
    </div>
  )

  // ─── Top Toolbar ─────────────────────────────────────────────────────────

  const toolbar = (
    <div className="flex items-center gap-1 px-3 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0 flex-wrap">
      {/* Back button */}
      {!focusMode && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
              <ArrowLeft className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">返回要点编辑</TooltipContent>
        </Tooltip>
      )}

      {/* Mobile chapter drawer trigger */}
      {isMobile && !focusMode && (
        <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <PanelLeftOpen className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>章节目录</SheetTitle>
            </SheetHeader>
            {leftSidebar}
          </SheetContent>
        </Sheet>
      )}

      {/* Focus mode toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" onClick={toggleFocusMode}>
            {focusMode ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{focusMode ? '退出专注模式' : '专注模式'}</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Chapter navigation */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" onClick={goToPrevChapter} disabled={currentChapterIndex <= 0}>
            <ChevronLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">上一章</TooltipContent>
      </Tooltip>

      <span className="text-xs text-muted-foreground tabular-nums min-w-[60px] text-center">
        {currentChapterIndex + 1} / {sortedChapters.length}
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" onClick={goToNextChapter} disabled={currentChapterIndex >= sortedChapters.length - 1}>
            <ChevronRight className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">下一章</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* AI Assist Buttons */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-7 gap-1.5 text-xs', aiLoading ? 'text-emerald-500' : 'text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400')}
            onClick={() => callAIAssist('continue')}
            disabled={aiLoading}
          >
            {aiLoading && aiMode === 'continue' ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
            <span className="hidden sm:inline">续写</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">AI续写</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
            onClick={() => {
              const sel = getSelectedText()
              if (!sel) {
                toast.error('请先选择要改写的文本')
                return
              }
              setSelectedText(sel)
              callAIAssist('rewrite')
            }}
            disabled={aiLoading}
          >
            <Copy className="size-3.5" />
            <span className="hidden sm:inline">改写</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">AI改写</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400"
            onClick={() => callAIAssist('dialogue')}
            disabled={aiLoading}
          >
            <MessageCircle className="size-3.5" />
            <span className="hidden sm:inline">对话</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">AI生成对话</TooltipContent>
      </Tooltip>

      <Popover open={aiPopoverOpen} onOpenChange={setAiPopoverOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                disabled={aiLoading}
              >
                <Lightbulb className="size-3.5" />
                <span className="hidden sm:inline">建议</span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">AI建议</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-auto p-2" side="bottom" align="start">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => callAIAssist('suggest')}>
              <Lightbulb className="size-3.5 text-purple-500" />获取写作方向建议
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => callAIAssist('continue')}>
              <Wand2 className="size-3.5 text-emerald-500" />AI续写下一段
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => callAIAssist('dialogue')}>
              <MessageCircle className="size-3.5 text-amber-500" />生成角色对话
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Status toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStatusToggle}
            className={cn(
              'h-7 gap-1.5 text-xs',
              activeChapter?.status === 'completed'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground'
            )}
          >
            {activeChapter?.status === 'completed' ? (
              <><Check className="size-3" />已完成</>
            ) : (
              <><PenLine className="size-3" />草稿</>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">切换状态：{activeChapter?.status === 'completed' ? '草稿' : '已完成'}</TooltipContent>
      </Tooltip>

      {/* Right side: save + word count */}
      <div className="ml-auto flex items-center gap-3">
        {renderSaveStatus()}
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatWordCount(wordCount)}字
          </span>
          <span className="text-[10px] text-muted-foreground/60">/ 总{formatWordCount(totalWordCount)}字</span>
        </div>
      </div>
    </div>
  )

  // ─── Main Layout ─────────────────────────────────────────────────────────

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <FileText className="size-8 opacity-40" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">暂无章节</h3>
        <p className="text-sm text-center max-w-xs">
          请返回规划章节步骤，先添加章节再开始写作
        </p>
        <Button variant="outline" onClick={onBack} className="mt-4 gap-1.5">
          <ArrowLeft className="size-4" />返回规划章节
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {toolbar}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        {!focusMode && !isMobile && (
          <div className="w-56 border-r shrink-0 overflow-hidden">
            {leftSidebar}
          </div>
        )}

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Title */}
          <div className="px-6 pt-4 pb-2 shrink-0">
            <Input
              value={title}
              onChange={handleTitleChange}
              placeholder="章节标题"
              className="text-lg font-bold border-none bg-transparent shadow-none focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40 font-serif"
              style={{ fontFamily: '"Noto Serif SC", "Source Han Serif CN", "STSong", Georgia, serif' }}
            />
          </div>

          {/* Text area */}
          <div className="flex-1 overflow-hidden px-6 pb-4">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="开始写作..."
              className={cn(
                'w-full h-full resize-none bg-transparent text-foreground/90 leading-[1.8] text-[15px] outline-none',
                'placeholder:text-muted-foreground/30'
              )}
              style={{ fontFamily: '"Noto Serif SC", "Source Han Serif CN", "STSong", Georgia, serif' }}
            />
          </div>

          {/* AI Panel */}
          {aiPanel}
        </div>

        {/* Right sidebar */}
        {!focusMode && !isMobile && (
          <div className="w-64 border-l shrink-0 overflow-hidden">
            {rightSidebar}
          </div>
        )}

        {/* Mobile right sidebar via sheet */}
        {!focusMode && isMobile && activeChapter && (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="fixed bottom-4 right-4 size-10 rounded-full shadow-md bg-background border z-20 md:hidden"
              >
                <Eye className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>写作参考</SheetTitle>
              </SheetHeader>
              {rightSidebar}
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  )
}

// ─── AI Assist Panel inline helper (fix mode reference) ────────────────────
// The above aiPanel uses `mode` variable which doesn't exist in scope.
// We re-declare the panel as a sub-function that uses `aiMode` state instead.

// ─── Main Component: WritingSpace ────────────────────────────────────────────

export default function WritingSpace() {
  const {
    currentProject,
    activeUnitId,
    setActiveUnitId,
    writingStep,
    setWritingStep,
  } = useAppStore()

  // Handle unit selection → move to step 2
  const handleSelectUnit = useCallback((unitId: string) => {
    setActiveUnitId(unitId)
    setWritingStep('plan_chapters')
  }, [setActiveUnitId, setWritingStep])

  // Step navigation
  const handleStepClick = useCallback((step: WritingStep) => {
    // Can only go back to completed steps or stay on current
    const stepOrder: WritingStep[] = ['select_unit', 'plan_chapters', 'plot_points', 'write']
    const currentIdx = stepOrder.indexOf(writingStep)
    const targetIdx = stepOrder.indexOf(step)
    if (targetIdx <= currentIdx) {
      setWritingStep(step)
      if (step === 'select_unit') {
        setActiveUnitId(null)
      }
    }
  }, [writingStep, setWritingStep, setActiveUnitId])

  const handleBackFromPlan = useCallback(() => {
    setWritingStep('select_unit')
    setActiveUnitId(null)
  }, [setWritingStep, setActiveUnitId])

  const handleBackFromPlotPoints = useCallback(() => {
    setWritingStep('plan_chapters')
  }, [setWritingStep])

  const handleBackFromWrite = useCallback(() => {
    setWritingStep('plot_points')
  }, [setWritingStep])

  // Reset step when no project
  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <BookOpen className="size-8 opacity-40" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">尚未选择项目</h3>
        <p className="text-sm text-center max-w-xs">
          请先在灵感实验室创建或选择一个项目，然后进入创作空间开始写作
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator - hidden in focus mode writing step */}
      <StepIndicator currentStep={writingStep} onStepClick={handleStepClick} />

      {/* Step content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {writingStep === 'select_unit' && (
            <motion.div
              key="select_unit"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <UnitSelector onSelectUnit={handleSelectUnit} />
            </motion.div>
          )}

          {writingStep === 'plan_chapters' && activeUnitId && (
            <motion.div
              key="plan_chapters"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <ChapterPlanner
                unitId={activeUnitId}
                onNext={() => setWritingStep('plot_points')}
                onBack={handleBackFromPlan}
              />
            </motion.div>
          )}

          {writingStep === 'plot_points' && activeUnitId && (
            <motion.div
              key="plot_points"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <PlotPointEditor
                unitId={activeUnitId}
                onNext={() => setWritingStep('write')}
                onBack={handleBackFromPlotPoints}
              />
            </motion.div>
          )}

          {writingStep === 'write' && activeUnitId && (
            <motion.div
              key="write"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <WritingEditor
                unitId={activeUnitId}
                onBack={handleBackFromWrite}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
