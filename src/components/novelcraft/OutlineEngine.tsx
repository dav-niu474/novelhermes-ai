'use client'

import { useState, useCallback } from 'react'
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
  BookMarked,
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { useAppStore } from '@/lib/store'
import type { Chapter, StoryBeat, BeatType } from '@/lib/types'
import { BEAT_TYPE_LABELS, BEAT_TYPE_COLORS } from '@/lib/types'

// ─── Beat color mapping for text / border variants ───
const BEAT_TEXT_COLORS: Record<BeatType, string> = {
  opening: 'text-emerald-600',
  conflict: 'text-red-600',
  turn: 'text-amber-600',
  suspense: 'text-purple-600',
}

const BEAT_BORDER_COLORS: Record<BeatType, string> = {
  opening: 'border-emerald-400',
  conflict: 'border-red-400',
  turn: 'border-amber-400',
  suspense: 'border-purple-400',
}

const BEAT_BG_COLORS: Record<BeatType, string> = {
  opening: 'bg-emerald-50',
  conflict: 'bg-red-50',
  turn: 'bg-amber-50',
  suspense: 'bg-purple-50',
}

const BEAT_DOT_RING: Record<BeatType, string> = {
  opening: 'ring-emerald-500/30',
  conflict: 'ring-red-500/30',
  turn: 'ring-amber-500/30',
  suspense: 'ring-purple-500/30',
}

// ─── Sub-components ───

function BeatIndicator({ beat }: { beat: StoryBeat }) {
  const beatType = beat.type as BeatType
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors hover:bg-accent/50">
          <span
            className={`mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full ring-2 ${BEAT_TYPE_COLORS[beatType]} ${BEAT_DOT_RING[beatType]}`}
          />
          <div className="min-w-0 flex-1">
            <span
              className={`text-xs font-semibold ${BEAT_TEXT_COLORS[beatType]}`}
            >
              {BEAT_TYPE_LABELS[beatType]}
            </span>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
              {beat.content}
            </p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">
          {BEAT_TYPE_LABELS[beatType]}节拍
        </p>
        <p className="mt-1 text-xs opacity-90">{beat.content}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function ChapterCard({
  chapter,
  index,
  isRegenerating,
  onRegenerateBeats,
  onEnterWriting,
}: {
  chapter: Chapter
  index: number
  isRegenerating: boolean
  onRegenerateBeats: (chapterId: string) => void
  onEnterWriting: (chapterId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const sortedBeats = [...chapter.storyBeats].sort(
    (a, b) => a.order - b.order
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
    >
      <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
        {/* Chapter number accent bar */}
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 via-amber-400 to-purple-500" />

        <CardHeader className="pl-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-purple-500 text-xs font-bold text-white shadow-sm">
                {chapter.order}
              </span>
              <div className="min-w-0">
                <CardTitle className="text-base leading-snug">
                  {chapter.title || `第${chapter.order}章`}
                </CardTitle>
                {chapter.summary && (
                  <CardDescription className="mt-1 line-clamp-2 text-sm">
                    {chapter.summary}
                  </CardDescription>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded(!expanded)}
                aria-label={expanded ? '收起节拍' : '展开节拍'}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <CardContent className="pl-6 pt-0">
                {/* Beat dots row — compact indicator */}
                <div className="mb-3 flex items-center gap-1.5">
                  {sortedBeats.map((beat) => {
                    const bt = beat.type as BeatType
                    return (
                      <Tooltip key={beat.id}>
                        <TooltipTrigger asChild>
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${BEAT_TYPE_COLORS[bt]} cursor-pointer transition-transform hover:scale-125`}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {BEAT_TYPE_LABELS[bt]}: {beat.content}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                  <span className="ml-1.5 text-[11px] text-muted-foreground">
                    {sortedBeats.length} 个节拍
                  </span>
                </div>

                {/* Beat detail cards */}
                <div className="grid gap-2 sm:grid-cols-2">
                  {sortedBeats.map((beat) => (
                    <BeatIndicator key={beat.id} beat={beat} />
                  ))}
                </div>

                {/* Action row */}
                <Separator className="my-3" />
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => onRegenerateBeats(chapter.id)}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    重新生成节拍
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => onEnterWriting(chapter.id)}
                  >
                    进入写作
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

function TimelineConnector() {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="h-6 w-px bg-gradient-to-b from-purple-300 to-emerald-300" />
      <GitBranch className="h-4 w-4 text-muted-foreground/50 rotate-90" />
      <div className="h-6 w-px bg-gradient-to-b from-emerald-300 to-purple-300" />
    </div>
  )
}

function EmptyOutlineState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 px-6 py-16 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-purple-100">
        <GitBranch className="h-8 w-8 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold">尚无大纲</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        让AI根据您的灵感火花和世界观设定，推演出具有因果逻辑的前五章大纲
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

function SkeletonChapterCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1.5 mb-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-2.5 w-2.5 rounded-full" />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Main Component ───

export default function OutlineEngine() {
  const {
    currentProject,
    setCurrentProject,
    isLoading,
    setIsLoading,
    setActiveTab,
    setActiveChapterId,
  } = useAppStore()

  const [regeneratingChapterId, setRegeneratingChapterId] = useState<
    string | null
  >(null)

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
      if (!res.ok) throw new Error('生成大纲失败')
      const data = await res.json()
      if (data.project) {
        setCurrentProject(data.project)
      }
    } catch (err) {
      console.error('Outline generation error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [currentProject, setCurrentProject, setIsLoading])

  // ─── Regenerate beats for single chapter ───
  const handleRegenerateBeats = useCallback(
    async (chapterId: string) => {
      if (!currentProject) return
      setRegeneratingChapterId(chapterId)
      try {
        const res = await fetch('/api/ai/beats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId,
            projectId: currentProject.id,
          }),
        })
        if (!res.ok) throw new Error('重新生成节拍失败')
        // Refresh entire project from DB
        const freshRes = await fetch(`/api/projects/${currentProject.id}`)
        if (freshRes.ok) {
          const freshProject = await freshRes.json()
          setCurrentProject(freshProject)
        }
      } catch (err) {
        console.error('Beat regeneration error:', err)
      } finally {
        setRegeneratingChapterId(null)
      }
    },
    [currentProject, setCurrentProject]
  )

  // ─── Navigate to writing tab ───
  const handleEnterWriting = useCallback(
    (chapterId: string) => {
      setActiveChapterId(chapterId)
      setActiveTab('writing')
    },
    [setActiveChapterId, setActiveTab]
  )

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

  const chapters = currentProject.chapters
    ? [...currentProject.chapters].sort((a, b) => a.order - b.order)
    : []

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ── Header Section ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <GitBranch className="h-6 w-6 text-emerald-600" />
            因果律大纲推演
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI 根据灵感火花与世界观，推演出因果连贯的章节大纲
          </p>
        </div>

        <Button
          className="gap-2 bg-gradient-to-r from-emerald-600 to-purple-600 text-white shadow-md hover:opacity-90 shrink-0"
          size="lg"
          onClick={handleGenerateOutline}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          一键推演大纲
        </Button>
      </div>

      {/* ── Project Info Summary ── */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4">
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
              {chapters.length} 章
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Chapter Timeline ── */}
      {isLoading && chapters.length === 0 ? (
        // Skeleton loading state
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <SkeletonChapterCard index={i} />
              {i < 4 && <TimelineConnector />}
            </div>
          ))}
        </div>
      ) : chapters.length === 0 ? (
        // Empty state
        <EmptyOutlineState onGenerate={handleGenerateOutline} />
      ) : (
        // Chapter timeline
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[19px] top-0 bottom-0 hidden w-px bg-gradient-to-b from-emerald-300 via-amber-300 to-purple-300 sm:block" />

          <div className="space-y-2">
            {chapters.map((chapter, idx) => (
              <div key={chapter.id}>
                <ChapterCard
                  chapter={chapter}
                  index={idx}
                  isRegenerating={regeneratingChapterId === chapter.id}
                  onRegenerateBeats={handleRegenerateBeats}
                  onEnterWriting={handleEnterWriting}
                />
                {idx < chapters.length - 1 && <TimelineConnector />}
              </div>
            ))}
          </div>

          {/* Generating overlay when re-generating entire outline */}
          {isLoading && chapters.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-700"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              正在重新推演大纲...
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}
