'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  RefreshCw,
  ArrowRight,
  Loader2,
  GitBranch,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronRight,
  BookMarked,
  Plus,
  Trash2,
  Pencil,
  PenLine,
  Library,
  Target,
  X,
  Check,
  FolderOpen,
  Layers,
  FileText,
  Crosshair,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { useAppStore } from '@/lib/store'
import type {
  Volume,
  Stage,
  Unit,
  Chapter,
  PlotLine,
  PlotPoint,
  StoryBeat,
  BeatType,
} from '@/lib/types'
import {
  BEAT_TYPE_LABELS,
  BEAT_TYPE_COLORS,
  PLOT_LINE_COLORS,
  PLOT_LINE_TYPE_LABELS,
} from '@/lib/types'
import { toast } from 'sonner'

// ─── Color Maps ───
const BEAT_TEXT_COLORS: Record<BeatType, string> = {
  opening: 'text-emerald-600 dark:text-emerald-400',
  conflict: 'text-red-600 dark:text-red-400',
  turn: 'text-amber-600 dark:text-amber-400',
  suspense: 'text-purple-600 dark:text-purple-400',
}

const BEAT_BG_COLORS: Record<BeatType, string> = {
  opening: 'bg-emerald-50 dark:bg-emerald-950/40',
  conflict: 'bg-red-50 dark:bg-red-950/40',
  turn: 'bg-amber-50 dark:bg-amber-950/40',
  suspense: 'bg-purple-50 dark:bg-purple-950/40',
}

const LEVEL_LABELS: Record<string, string> = {
  volume: '卷',
  stage: '阶段',
  unit: '单元',
  chapter: '章',
}

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  volume: <BookOpen className="h-3.5 w-3.5" />,
  stage: <Layers className="h-3.5 w-3.5" />,
  unit: <FolderOpen className="h-3.5 w-3.5" />,
  chapter: <FileText className="h-3.5 w-3.5" />,
}

const PLOT_STATUS_COLORS: Record<string, string> = {
  planned: 'bg-slate-400',
  writing: 'bg-amber-400',
  completed: 'bg-emerald-400',
}

const PLOT_STATUS_LABELS: Record<string, string> = {
  planned: '计划中',
  writing: '写作中',
  completed: '已完成',
}

// ─── Helper: Refresh Project ───
async function refreshProject(projectId: string) {
  const res = await fetch(`/api/projects/${projectId}`)
  if (res.ok) {
    const data = await res.json()
    const store = useAppStore.getState()
    store.setCurrentProject(data)
  }
}

// ─── Inline Editable Field ───
function InlineEditField({
  value,
  onSave,
  placeholder = '点击编辑',
  multiline = false,
  className = '',
}: {
  value: string | null
  onSave: (val: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')

  const handleSave = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed !== (value || '').trim()) {
      onSave(trimmed)
    }
    setEditing(false)
  }, [draft, value, onSave])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !multiline) {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        setDraft(value || '')
        setEditing(false)
      }
    },
    [handleSave, multiline, value]
  )

  if (editing) {
    const Component = multiline ? Textarea : Input
    return (
      <Component
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className={`text-sm ${className}`}
        placeholder={placeholder}
      />
    )
  }

  return (
    <span
      className={`cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-accent/50 ${className}`}
      onClick={() => {
        setDraft(value || '')
        setEditing(true)
      }}
      title="点击编辑"
    >
      {value || <span className="text-muted-foreground italic">{placeholder}</span>}
    </span>
  )
}

// ─── Beat Dot ───
function BeatDot({ beat }: { beat: StoryBeat }) {
  const bt = beat.type as BeatType
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${BEAT_TYPE_COLORS[bt]} cursor-pointer transition-transform hover:scale-150`}
        />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px]">
        <p className="font-medium">{BEAT_TYPE_LABELS[bt]}</p>
        <p className="text-xs opacity-90">{beat.content}</p>
      </TooltipContent>
    </Tooltip>
  )
}

// ─── Chapter Row ───
function ChapterRow({
  chapter,
  onEdit,
  onDelete,
  onEnterWriting,
}: {
  chapter: Chapter
  onEdit: (field: string, value: string) => void
  onDelete: () => void
  onEnterWriting: () => void
}) {
  const beats = [...(chapter.storyBeats || [])].sort((a, b) => a.order - b.order)

  // Parse plotPoints JSON
  let plotPointList: string[] = []
  try {
    plotPointList = chapter.plotPoints ? JSON.parse(chapter.plotPoints) : []
  } catch {
    plotPointList = []
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="group relative flex items-start gap-2 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-accent/30"
    >
      {/* Order badge */}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[10px] font-bold text-white">
        {chapter.order}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <InlineEditField
            value={chapter.title}
            onSave={(v) => onEdit('title', v)}
            className="font-medium text-sm"
            placeholder="章节标题"
          />
          {plotPointList.length > 0 && (
            <Badge variant="outline" className="h-5 gap-1 text-[10px] px-1.5 shrink-0">
              <Crosshair className="h-2.5 w-2.5" />
              {plotPointList.length}
            </Badge>
          )}
        </div>
        {chapter.summary && (
          <InlineEditField
            value={chapter.summary}
            onSave={(v) => onEdit('summary', v)}
            multiline
            className="text-xs text-muted-foreground mt-0.5"
            placeholder="章节概要"
          />
        )}
        {/* Beat dots */}
        {beats.length > 0 && (
          <div className="mt-1 flex items-center gap-1">
            {beats.map((b) => (
              <BeatDot key={b.id} beat={b} />
            ))}
            <span className="ml-1 text-[10px] text-muted-foreground">
              {beats.length}节拍
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onEnterWriting}
            >
              <PenLine className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>进入写作</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除章节「{chapter.title}」吗？此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.div>
  )
}

// ─── Unit Node ───
function UnitNode({
  unit,
  projectId,
  onRefresh,
}: {
  unit: Unit
  projectId: string
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(true)
  const { setActiveUnitId, setActiveTab } = useAppStore()

  const handleEditUnit = useCallback(
    async (field: string, value: string) => {
      try {
        const res = await fetch(`/api/units/${unit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
        if (!res.ok) throw new Error('更新失败')
        onRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '更新失败')
      }
    },
    [unit.id, onRefresh]
  )

  const handleAddChapter = useCallback(async () => {
    try {
      const res = await fetch(`/api/units/${unit.id}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新章节', projectId }),
      })
      if (!res.ok) throw new Error('添加章节失败')
      onRefresh()
      toast.success('已添加新章节')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加章节失败')
    }
  }, [unit.id, projectId, onRefresh])

  const handleDeleteChapter = useCallback(
    async (chapterId: string) => {
      try {
        const res = await fetch(`/api/chapters/${chapterId}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('删除失败')
        onRefresh()
        toast.success('已删除章节')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '删除失败')
      }
    },
    [onRefresh]
  )

  const handleEditChapter = useCallback(
    async (chapterId: string, field: string, value: string) => {
      try {
        const res = await fetch(`/api/chapters/${chapterId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
        if (!res.ok) throw new Error('更新失败')
        onRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '更新失败')
      }
    },
    [onRefresh]
  )

  const handleEnterWriting = useCallback(
    (unitId: string) => {
      setActiveUnitId(unitId)
      setActiveTab('writing')
    },
    [setActiveUnitId, setActiveTab]
  )

  const chapters = [...(unit.chapters || [])].sort((a, b) => a.order - b.order)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-amber-50/50 dark:hover:bg-amber-950/20">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1">
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
              <FolderOpen className="h-3 w-3" />
            </span>
          </button>
        </CollapsibleTrigger>
        <span className="text-[10px] text-muted-foreground font-mono">{unit.order}.</span>
        <InlineEditField
          value={unit.title}
          onSave={(v) => handleEditUnit('title', v)}
          className="text-sm font-medium"
          placeholder="单元标题"
        />
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-emerald-600 hover:text-emerald-700"
                onClick={() => handleEnterWriting(unit.id)}
              >
                <ArrowRight className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>进入写作</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={handleAddChapter}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>添加章节</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {unit.summary && (
        <div className="ml-9 px-2 pb-1">
          <InlineEditField
            value={unit.summary}
            onSave={(v) => handleEditUnit('summary', v)}
            multiline
            className="text-xs text-muted-foreground"
            placeholder="单元概要"
          />
        </div>
      )}
      <CollapsibleContent>
        <div className="ml-7 border-l-2 border-amber-200 dark:border-amber-800 pl-3 pr-1">
          {chapters.length === 0 ? (
            <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              暂无章节
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 ml-1 text-xs"
                onClick={handleAddChapter}
              >
                添加
              </Button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {chapters.map((ch) => (
                <ChapterRow
                  key={ch.id}
                  chapter={ch}
                  onEdit={(field, val) => handleEditChapter(ch.id, field, val)}
                  onDelete={() => handleDeleteChapter(ch.id)}
                  onEnterWriting={() => handleEnterWriting(unit.id)}
                />
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Stage Node ───
function StageNode({
  stage,
  projectId,
  onRefresh,
}: {
  stage: Stage
  projectId: string
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(true)

  const handleEditStage = useCallback(
    async (field: string, value: string) => {
      try {
        const res = await fetch(`/api/stages/${stage.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
        if (!res.ok) throw new Error('更新失败')
        onRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '更新失败')
      }
    },
    [stage.id, onRefresh]
  )

  const handleAddUnit = useCallback(async () => {
    try {
      const res = await fetch(`/api/stages/${stage.id}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新单元' }),
      })
      if (!res.ok) throw new Error('添加单元失败')
      onRefresh()
      toast.success('已添加新单元')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加单元失败')
    }
  }, [stage.id, onRefresh])

  const handleDeleteStage = useCallback(async () => {
    try {
      const res = await fetch(`/api/stages/${stage.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      onRefresh()
      toast.success('已删除阶段')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    }
  }, [stage.id, onRefresh])

  const units = [...(stage.units || [])].sort((a, b) => a.order - b.order)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1">
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-emerald-500" />
            )}
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <Layers className="h-3 w-3" />
            </span>
          </button>
        </CollapsibleTrigger>
        <span className="text-[10px] text-muted-foreground font-mono">{stage.order}.</span>
        <InlineEditField
          value={stage.title}
          onSave={(v) => handleEditStage('title', v)}
          className="text-sm font-medium"
          placeholder="阶段标题"
        />
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={handleAddUnit}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>添加单元</TooltipContent>
          </Tooltip>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除阶段「{stage.title}」及其下所有单元和章节吗？此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteStage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {stage.summary && (
        <div className="ml-9 px-2 pb-1">
          <InlineEditField
            value={stage.summary}
            onSave={(v) => handleEditStage('summary', v)}
            multiline
            className="text-xs text-muted-foreground"
            placeholder="阶段概要"
          />
        </div>
      )}
      <CollapsibleContent>
        <div className="ml-5 border-l-2 border-emerald-200 dark:border-emerald-800 pl-3">
          {units.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
              暂无单元
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 ml-1 text-xs"
                onClick={handleAddUnit}
              >
                添加
              </Button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {units.map((u) => (
                <UnitNode
                  key={u.id}
                  unit={u}
                  projectId={projectId}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Volume Node ───
function VolumeNode({
  volume,
  projectId,
  onRefresh,
}: {
  volume: Volume
  projectId: string
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(true)

  const handleEditVolume = useCallback(
    async (field: string, value: string) => {
      try {
        const res = await fetch(`/api/volumes/${volume.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
        if (!res.ok) throw new Error('更新失败')
        onRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '更新失败')
      }
    },
    [volume.id, onRefresh]
  )

  const handleAddStage = useCallback(async () => {
    try {
      const res = await fetch(`/api/volumes/${volume.id}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新阶段' }),
      })
      if (!res.ok) throw new Error('添加阶段失败')
      onRefresh()
      toast.success('已添加新阶段')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加阶段失败')
    }
  }, [volume.id, onRefresh])

  const handleDeleteVolume = useCallback(async () => {
    try {
      const res = await fetch(`/api/volumes/${volume.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      onRefresh()
      toast.success('已删除卷')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    }
  }, [volume.id, onRefresh])

  const stages = [...(volume.stages || [])].sort((a, b) => a.order - b.order)
  const totalChapters = stages.reduce(
    (acc, s) => acc + (s.units?.reduce((a2, u) => a2 + (u.chapters?.length || 0), 0) || 0),
    0
  )

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* Volume Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-gradient-to-r from-purple-50/80 to-emerald-50/80 dark:from-purple-950/20 dark:to-emerald-950/20">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5">
              {open ? (
                <ChevronDown className="h-4 w-4 text-purple-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-purple-500" />
              )}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-emerald-500 text-[10px] font-bold text-white">
                {volume.order}
              </span>
            </button>
          </CollapsibleTrigger>
          <InlineEditField
            value={volume.title}
            onSave={(v) => handleEditVolume('title', v)}
            className="text-base font-semibold"
            placeholder="卷标题"
          />
          <Badge variant="secondary" className="h-5 text-[10px] gap-0.5 shrink-0 ml-1">
            <FileText className="h-2.5 w-2.5" />
            {totalChapters}章
          </Badge>
          <div className="ml-auto flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleAddStage}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>添加阶段</TooltipContent>
            </Tooltip>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定要删除卷「{volume.title}」及其下所有阶段、单元和章节吗？此操作不可撤销。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteVolume} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {volume.summary && (
          <div className="px-8 py-1.5 bg-muted/30">
            <InlineEditField
              value={volume.summary}
              onSave={(v) => handleEditVolume('summary', v)}
              multiline
              className="text-xs text-muted-foreground"
              placeholder="卷概要"
            />
          </div>
        )}
        <CollapsibleContent>
          <CardContent className="p-2">
            {stages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-xs text-muted-foreground">
                <Layers className="mb-1.5 h-6 w-6 opacity-50" />
                暂无阶段
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-6 gap-1 text-xs"
                  onClick={handleAddStage}
                >
                  <Plus className="h-3 w-3" />
                  添加阶段
                </Button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {stages.map((s) => (
                  <StageNode
                    key={s.id}
                    stage={s}
                    projectId={projectId}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ─── Plot Line Card ───
function PlotLineCard({
  plotLine,
  projectId,
  onRefresh,
  allVolumes,
}: {
  plotLine: PlotLine
  projectId: string
  onRefresh: () => void
  allVolumes: Volume[]
}) {
  const [open, setOpen] = useState(true)
  const [showAddPoint, setShowAddPoint] = useState(false)
  const [newPointTitle, setNewPointTitle] = useState('')
  const [newPointLevel, setNewPointLevel] = useState<string>('unit')
  const [newPointTargetId, setNewPointTargetId] = useState<string>('')

  const lineColor = plotLine.color || PLOT_LINE_COLORS[0]

  const handleEditPlotLine = useCallback(
    async (field: string, value: string) => {
      try {
        const res = await fetch(`/api/plot-lines/${plotLine.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
        if (!res.ok) throw new Error('更新失败')
        onRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '更新失败')
      }
    },
    [plotLine.id, onRefresh]
  )

  const handleDeletePlotLine = useCallback(async () => {
    try {
      const res = await fetch(`/api/plot-lines/${plotLine.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('删除失败')
      onRefresh()
      toast.success('已删除剧情线')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    }
  }, [plotLine.id, onRefresh])

  const handleAddPlotPoint = useCallback(async () => {
    if (!newPointTitle.trim()) {
      toast.error('请输入剧情点标题')
      return
    }
    try {
      const res = await fetch(`/api/plot-lines/${plotLine.id}/plot-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPointTitle.trim(),
          targetLevel: newPointLevel,
          targetId: newPointTargetId || undefined,
        }),
      })
      if (!res.ok) throw new Error('添加剧情点失败')
      onRefresh()
      setNewPointTitle('')
      setShowAddPoint(false)
      toast.success('已添加剧情点')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加剧情点失败')
    }
  }, [plotLine.id, newPointTitle, newPointLevel, newPointTargetId, onRefresh])

  const handleEditPlotPoint = useCallback(
    async (pointId: string, field: string, value: string) => {
      try {
        const res = await fetch(`/api/plot-points/${pointId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
        if (!res.ok) throw new Error('更新失败')
        onRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '更新失败')
      }
    },
    [onRefresh]
  )

  const handleDeletePlotPoint = useCallback(
    async (pointId: string) => {
      try {
        const res = await fetch(`/api/plot-points/${pointId}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('删除失败')
        onRefresh()
        toast.success('已删除剧情点')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '删除失败')
      }
    },
    [onRefresh]
  )

  // Build target options for the selected level
  const targetOptions = useMemo(() => {
    const options: { id: string; label: string }[] = []
    for (const vol of allVolumes) {
      if (newPointLevel === 'volume') {
        options.push({ id: vol.id, label: vol.title })
      }
      for (const stg of vol.stages || []) {
        if (newPointLevel === 'stage') {
          options.push({ id: stg.id, label: `${vol.title} > ${stg.title}` })
        }
        for (const unt of stg.units || []) {
          if (newPointLevel === 'unit') {
            options.push({
              id: unt.id,
              label: `${vol.title} > ${stg.title} > ${unt.title}`,
            })
          }
          for (const ch of unt.chapters || []) {
            if (newPointLevel === 'chapter') {
              options.push({
                id: ch.id,
                label: `${vol.title} > ${stg.title} > ${unt.title} > ${ch.title}`,
              })
            }
          }
        }
      }
    }
    return options
  }, [allVolumes, newPointLevel])

  const plotPoints = [...(plotLine.plotPoints || [])].sort(
    (a, b) => a.order - b.order
  )

  return (
    <Card
      className="overflow-hidden transition-shadow hover:shadow-md"
      style={{ borderLeftColor: lineColor, borderLeftWidth: '3px' }}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5">
              {open ? (
                <ChevronDown className="h-3.5 w-3.5" style={{ color: lineColor }} />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" style={{ color: lineColor }} />
              )}
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: lineColor }}
              />
            </button>
          </CollapsibleTrigger>
          <Badge
            variant={plotLine.type === 'main' ? 'default' : 'secondary'}
            className="h-4 text-[10px] px-1.5"
            style={plotLine.type === 'main' ? { backgroundColor: lineColor, color: '#fff' } : {}}
          >
            {PLOT_LINE_TYPE_LABELS[plotLine.type] || plotLine.type}
          </Badge>
          <InlineEditField
            value={plotLine.title}
            onSave={(v) => handleEditPlotLine('title', v)}
            className="text-sm font-medium"
            placeholder="剧情线标题"
          />
          <span className="text-[10px] text-muted-foreground ml-1">
            {plotPoints.length}点
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setShowAddPoint(!showAddPoint)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>添加剧情点</TooltipContent>
            </Tooltip>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定要删除剧情线「{plotLine.title}」及其下所有剧情点吗？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeletePlotLine} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {plotLine.description && (
          <div className="px-8 pb-1">
            <InlineEditField
              value={plotLine.description}
              onSave={(v) => handleEditPlotLine('description', v)}
              multiline
              className="text-xs text-muted-foreground"
              placeholder="剧情线描述"
            />
          </div>
        )}
        <CollapsibleContent>
          <CardContent className="px-3 pb-3 pt-1">
            {/* Add plot point form */}
            <AnimatePresence>
              {showAddPoint && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-2 overflow-hidden rounded-md border bg-muted/30 p-2"
                >
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newPointTitle}
                      onChange={(e) => setNewPointTitle(e.target.value)}
                      placeholder="剧情点标题"
                      className="h-7 text-xs flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPlotPoint()}
                    />
                    <Select value={newPointLevel} onValueChange={(v) => { setNewPointLevel(v); setNewPointTargetId('') }}>
                      <SelectTrigger className="h-7 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="volume">卷</SelectItem>
                        <SelectItem value="stage">阶段</SelectItem>
                        <SelectItem value="unit">单元</SelectItem>
                        <SelectItem value="chapter">章</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {targetOptions.length > 0 && (
                    <Select value={newPointTargetId} onValueChange={setNewPointTargetId}>
                      <SelectTrigger className="h-7 text-xs w-full mb-2">
                        <SelectValue placeholder="关联目标（可选）" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setShowAddPoint(false)}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 text-xs"
                      style={{ backgroundColor: lineColor, color: '#fff' }}
                      onClick={handleAddPlotPoint}
                    >
                      添加
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Plot points timeline */}
            {plotPoints.length === 0 ? (
              <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
                <Target className="mr-1.5 h-3.5 w-3.5 opacity-50" />
                暂无剧情点
              </div>
            ) : (
              <div className="relative space-y-1">
                {plotPoints.map((pp, idx) => (
                  <motion.div
                    key={pp.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group relative flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/30"
                  >
                    {/* Timeline dot */}
                    <div className="mt-1 flex flex-col items-center">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ring-offset-1 ${PLOT_STATUS_COLORS[pp.status] || 'bg-slate-400'}`}
                        style={{ ringColor: lineColor + '40' }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <InlineEditField
                          value={pp.title}
                          onSave={(v) => handleEditPlotPoint(pp.id, 'title', v)}
                          className="text-xs font-medium"
                          placeholder="剧情点标题"
                        />
                        <Badge variant="outline" className="h-4 text-[9px] px-1 shrink-0">
                          {LEVEL_LABELS[pp.targetLevel] || pp.targetLevel}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="h-4 text-[9px] px-1 shrink-0"
                        >
                          {PLOT_STATUS_LABELS[pp.status] || pp.status}
                        </Badge>
                      </div>
                      {pp.description && (
                        <InlineEditField
                          value={pp.description}
                          onSave={(v) => handleEditPlotPoint(pp.id, 'description', v)}
                          multiline
                          className="text-[10px] text-muted-foreground mt-0.5"
                          placeholder="描述"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 shrink-0">
                      <Select
                        value={pp.status}
                        onValueChange={(v) => handleEditPlotPoint(pp.id, 'status', v)}
                      >
                        <SelectTrigger className="h-5 w-5 p-0 border-0 text-[9px]">
                          <span className="sr-only">状态</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">计划中</SelectItem>
                          <SelectItem value="writing">写作中</SelectItem>
                          <SelectItem value="completed">已完成</SelectItem>
                        </SelectContent>
                      </Select>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除剧情点「{pp.title}」吗？
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePlotPoint(pp.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ─── Plot Library View ───
function PlotLibrary({
  plotLines,
  allVolumes,
  onRefresh,
}: {
  plotLines: PlotLine[]
  allVolumes: Volume[]
  onRefresh: () => void
}) {
  const [filterLevel, setFilterLevel] = useState<string>('all')

  // Flatten all plot points
  const allPoints = useMemo(() => {
    const points: (PlotPoint & { plotLineTitle: string; plotLineColor: string })[] = []
    for (const pl of plotLines) {
      for (const pp of pl.plotPoints || []) {
        points.push({
          ...pp,
          plotLineTitle: pl.title,
          plotLineColor: pl.color || PLOT_LINE_COLORS[0],
        })
      }
    }
    if (filterLevel !== 'all') {
      return points.filter((p) => p.targetLevel === filterLevel)
    }
    return points.sort((a, b) => a.order - b.order)
  }, [plotLines, filterLevel])

  // Resolve target title
  const resolveTargetTitle = useCallback(
    (targetLevel: string, targetId: string): string => {
      for (const vol of allVolumes) {
        if (targetLevel === 'volume' && vol.id === targetId) return vol.title
        for (const stg of vol.stages || []) {
          if (targetLevel === 'stage' && stg.id === targetId) return `${vol.title} > ${stg.title}`
          for (const unt of stg.units || []) {
            if (targetLevel === 'unit' && unt.id === targetId)
              return `${vol.title} > ${stg.title} > ${unt.title}`
            for (const ch of unt.chapters || []) {
              if (targetLevel === 'chapter' && ch.id === targetId)
                return `${vol.title} > ${stg.title} > ${unt.title} > ${ch.title}`
            }
          }
        }
      }
      return '未关联'
    },
    [allVolumes]
  )

  const handleEditPlotPoint = useCallback(
    async (pointId: string, field: string, value: string) => {
      try {
        const res = await fetch(`/api/plot-points/${pointId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
        if (!res.ok) throw new Error('更新失败')
        onRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '更新失败')
      }
    },
    [onRefresh]
  )

  return (
    <div>
      {/* Filter */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">筛选层级:</span>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="volume">卷</SelectItem>
            <SelectItem value="stage">阶段</SelectItem>
            <SelectItem value="unit">单元</SelectItem>
            <SelectItem value="chapter">章</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground">
          共 {allPoints.length} 个剧情点
        </span>
      </div>

      {allPoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground">
          <Library className="mb-2 h-8 w-8 opacity-40" />
          暂无剧情点
        </div>
      ) : (
        <div className="grid gap-1.5">
          {allPoints.map((pp, idx) => (
            <motion.div
              key={pp.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="group rounded-md border px-3 py-2 transition-colors hover:bg-accent/30"
              style={{ borderLeftColor: pp.plotLineColor, borderLeftWidth: '3px' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: pp.plotLineColor }}
                />
                <InlineEditField
                  value={pp.title}
                  onSave={(v) => handleEditPlotPoint(pp.id, 'title', v)}
                  className="text-xs font-medium"
                  placeholder="剧情点标题"
                />
                <Badge variant="outline" className="h-4 text-[9px] px-1 shrink-0">
                  {LEVEL_LABELS[pp.targetLevel]}
                </Badge>
                <Badge
                  variant="secondary"
                  className="h-4 text-[9px] px-1 shrink-0"
                >
                  {PLOT_STATUS_LABELS[pp.status] || pp.status}
                </Badge>
              </div>
              {pp.description && (
                <InlineEditField
                  value={pp.description}
                  onSave={(v) => handleEditPlotPoint(pp.id, 'description', v)}
                  multiline
                  className="text-[10px] text-muted-foreground mt-0.5"
                  placeholder="描述"
                />
              )}
              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>来源:</span>
                <span className="font-medium" style={{ color: pp.plotLineColor }}>
                  {pp.plotLineTitle}
                </span>
                {pp.targetId && (
                  <>
                    <span className="mx-0.5">→</span>
                    <span>{resolveTargetTitle(pp.targetLevel, pp.targetId)}</span>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Add Plot Line Dialog ───
function AddPlotLineDialog({
  projectId,
  onRefresh,
  children,
}: {
  projectId: string
  onRefresh: () => void
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'main' | 'side'>('side')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PLOT_LINE_COLORS[1])

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      toast.error('请输入剧情线标题')
      return
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/plot-lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          type,
          description: description.trim() || undefined,
          color,
        }),
      })
      if (!res.ok) throw new Error('添加剧情线失败')
      onRefresh()
      setTitle('')
      setType('side')
      setDescription('')
      setColor(PLOT_LINE_COLORS[1])
      setOpen(false)
      toast.success('已添加剧情线')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加剧情线失败')
    }
  }, [projectId, title, type, description, color, onRefresh])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
            <GitBranch className="h-3 w-3" />
            添加剧情线
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加剧情线</DialogTitle>
          <DialogDescription>为主线或支线剧情创建一条新的剧情线</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">标题</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="剧情线标题"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">类型</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'main' | 'side')}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">主线</SelectItem>
                <SelectItem value="side">支线</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">描述</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="剧情线描述（可选）"
              className="mt-1"
              rows={3}
            />
          </div>
          <div>
            <Label className="text-xs">颜色</Label>
            <div className="mt-1 flex gap-2">
              {PLOT_LINE_COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c, ringColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Empty State ───
function EmptyOutlineState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 px-6 py-16 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-purple-100 dark:from-emerald-900/30 dark:to-purple-900/30">
        <GitBranch className="h-8 w-8 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold">尚无大纲</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        让AI根据您的灵感火花和世界观设定，推演出卷→阶段→单元→章的完整大纲结构
      </p>
      <Button
        className="mt-6 gap-2 bg-gradient-to-r from-emerald-600 to-purple-600 text-white shadow-md hover:opacity-90"
        size="lg"
        onClick={onGenerate}
      >
        <Sparkles className="h-4 w-4" />
        一键推演大纲
      </Button>
    </motion.div>
  )
}

// ─── Right Panel Content ───
function RightPanel({
  projectId,
  plotLines,
  allVolumes,
  onRefresh,
}: {
  projectId: string
  plotLines: PlotLine[]
  allVolumes: Volume[]
  onRefresh: () => void
}) {
  const mainLines = plotLines.filter((pl) => pl.type === 'main')
  const sideLines = plotLines.filter((pl) => pl.type === 'side')

  return (
    <Tabs defaultValue="plotlines" className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <TabsList className="h-8">
          <TabsTrigger value="plotlines" className="text-xs gap-1 px-2.5 h-7">
            <GitBranch className="h-3 w-3" />
            剧情线
          </TabsTrigger>
          <TabsTrigger value="library" className="text-xs gap-1 px-2.5 h-7">
            <Library className="h-3 w-3" />
            剧情库
          </TabsTrigger>
        </TabsList>
        <AddPlotLineDialog projectId={projectId} onRefresh={onRefresh} />
      </div>

      <TabsContent value="plotlines" className="flex-1 min-h-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-2 pr-2">
            {plotLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground">
                <GitBranch className="mb-2 h-8 w-8 opacity-40" />
                暂无剧情线
                <AddPlotLineDialog projectId={projectId} onRefresh={onRefresh}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 gap-1 text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    添加剧情线
                  </Button>
                </AddPlotLineDialog>
              </div>
            ) : (
              <>
                {mainLines.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-500" />
                      主线剧情
                    </h4>
                    <div className="space-y-2">
                      {mainLines.map((pl) => (
                        <PlotLineCard
                          key={pl.id}
                          plotLine={pl}
                          projectId={projectId}
                          onRefresh={onRefresh}
                          allVolumes={allVolumes}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {sideLines.length > 0 && (
                  <div className="mt-2">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                      <GitBranch className="h-3 w-3 text-purple-500" />
                      支线剧情
                    </h4>
                    <div className="space-y-2">
                      {sideLines.map((pl) => (
                        <PlotLineCard
                          key={pl.id}
                          plotLine={pl}
                          projectId={projectId}
                          onRefresh={onRefresh}
                          allVolumes={allVolumes}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="library" className="flex-1 min-h-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="pr-2">
            <PlotLibrary
              plotLines={plotLines}
              allVolumes={allVolumes}
              onRefresh={onRefresh}
            />
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}

// ─── Main Component ───
export default function OutlineEngine() {
  const {
    currentProject,
    isLoading,
    setIsLoading,
    setActiveTab,
    setActiveUnitId,
  } = useAppStore()

  const [mobileRightOpen, setMobileRightOpen] = useState(false)

  // ─── Refresh project data ───
  const handleRefresh = useCallback(async () => {
    if (!currentProject) return
    await refreshProject(currentProject.id)
  }, [currentProject])

  // ─── Generate full outline ───
  const handleGenerateOutline = useCallback(async () => {
    if (!currentProject) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/ai/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProject.id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '生成大纲失败')
      }
      const data = await res.json()
      if (data.project) {
        useAppStore.getState().setCurrentProject(data.project)
      }
      toast.success('大纲推演完成！')
    } catch (err) {
      console.error('Outline generation error:', err)
      toast.error(err instanceof Error ? err.message : '大纲推演失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }, [currentProject, setIsLoading])

  // ─── Add volume ───
  const handleAddVolume = useCallback(async () => {
    if (!currentProject) return
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/volumes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新卷' }),
      })
      if (!res.ok) throw new Error('添加卷失败')
      await handleRefresh()
      toast.success('已添加新卷')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加卷失败')
    }
  }, [currentProject, handleRefresh])

  // ─── No project selected ───
  if (!currentProject) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <BookMarked className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">请先创建项目</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          前往「灵感实验室」创建一个灵感火花，再来推演大纲
        </p>
        <Button
          variant="outline"
          className="mt-4 gap-2"
          onClick={() => setActiveTab('spark')}
        >
          <Sparkles className="h-4 w-4" />
          前往灵感实验室
        </Button>
      </div>
    )
  }

  const volumes = [...(currentProject.volumes || [])].sort((a, b) => a.order - b.order)
  const plotLines = currentProject.plotLines || []

  // Count total chapters
  const totalChapters = volumes.reduce(
    (acc, v) =>
      acc +
      (v.stages || []).reduce(
        (a2, s) =>
          a2 +
          (s.units || []).reduce(
            (a3, u) => a3 + (u.chapters?.length || 0),
            0
          ),
        0
      ),
    0
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      {/* ── Top Bar ── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <GitBranch className="h-6 w-6 text-emerald-600" />
            因果律大纲推演
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            卷 → 阶段 → 单元 → 章 的层级大纲，配合主线/支线剧情设计
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            className="gap-1.5 bg-gradient-to-r from-emerald-600 to-purple-600 text-white shadow-md hover:opacity-90"
            onClick={handleGenerateOutline}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            一键推演大纲
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleAddVolume}
          >
            <Plus className="h-3 w-3" />
            添加卷
          </Button>
          {/* Mobile: show right panel button */}
          <Sheet open={mobileRightOpen} onOpenChange={setMobileRightOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs lg:hidden"
              >
                <GitBranch className="h-3 w-3" />
                剧情面板
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] sm:max-w-md p-4 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>剧情线与剧情库</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <RightPanel
                  projectId={currentProject.id}
                  plotLines={plotLines}
                  allVolumes={volumes}
                  onRefresh={async () => {
                    await handleRefresh()
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* ── Project Info ── */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">
              {currentProject.title}
            </h3>
            {currentProject.synopsis && (
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                {currentProject.synopsis}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {currentProject.goldenFinger && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Zap className="h-3 w-3 text-amber-500" />
                金手指
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              <BookOpen className="mr-1 h-3 w-3" />
              {volumes.length}卷
            </Badge>
            <Badge variant="outline" className="text-xs">
              <FileText className="mr-1 h-3 w-3" />
              {totalChapters}章
            </Badge>
            {plotLines.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <GitBranch className="mr-1 h-3 w-3" />
                {plotLines.length}线
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Generating overlay ── */}
      {isLoading && volumes.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-400"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          正在推演大纲...
        </motion.div>
      )}

      {/* ── Two Panel Layout ── */}
      {volumes.length === 0 && !isLoading ? (
        <EmptyOutlineState onGenerate={handleGenerateOutline} />
      ) : (
        <div className="flex gap-4">
          {/* Left Panel: Hierarchical Outline Tree */}
          <div className="w-full lg:w-[60%] min-w-0">
            <ScrollArea className="h-[calc(100vh-260px)]">
              <div className="space-y-3 pr-1">
                {isLoading && volumes.length === 0 ? (
                  // Skeleton loading
                  Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="px-4 py-3 border-b bg-muted/30">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
                          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                        </div>
                      </div>
                      <CardContent className="p-4 space-y-3">
                        {Array.from({ length: 3 }).map((_, j) => (
                          <div key={j} className="h-8 rounded bg-muted animate-pulse" />
                        ))}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  volumes.map((vol) => (
                    <VolumeNode
                      key={vol.id}
                      volume={vol}
                      projectId={currentProject.id}
                      onRefresh={handleRefresh}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel: Plot Lines & Plot Library (desktop only) */}
          <div className="hidden lg:block lg:w-[40%] min-w-0">
            <RightPanel
              projectId={currentProject.id}
              plotLines={plotLines}
              allVolumes={volumes}
              onRefresh={handleRefresh}
            />
          </div>
        </div>
      )}
    </div>
  )
}
