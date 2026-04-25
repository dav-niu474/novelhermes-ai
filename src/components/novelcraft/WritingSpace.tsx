'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import type { Chapter, BeatType } from '@/lib/types'
import { BEAT_TYPE_LABELS, BEAT_TYPE_COLORS } from '@/lib/types'
import type { AdoptTarget } from '@/lib/store'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
  PanelLeftClose,
  PanelLeftOpen,
  Wand2,
  MessageCircle,
  Lightbulb,
  ArrowRight,
  Copy,
  RotateCcw,
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

// ─── Beat Color Mapping (Tailwind classes) ───────────────────────────────────

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

// ─── Save Status ─────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ─── AI Writing Assist Mode ──────────────────────────────────────────────────

type AIAssistMode = 'continue' | 'rewrite' | 'suggest' | 'dialogue'

interface SuggestionItem {
  title: string
  desc: string
}

// ─── Left Sidebar: Chapter Directory ─────────────────────────────────────────

function ChapterDirectory({
  chapters,
  activeChapterId,
  onSelectChapter,
  className,
}: {
  chapters: Chapter[]
  activeChapterId: string | null
  onSelectChapter: (id: string) => void
  className?: string
}) {
  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters]
  )

  return (
    <div className={cn('flex flex-col h-full', className)}>
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
                onClick={() => onSelectChapter(chapter.id)}
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
                      isActive
                        ? 'text-emerald-500'
                        : 'text-muted-foreground/50'
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
}

// ─── Right Sidebar: Chapter Reference ────────────────────────────────────────

function ChapterReference({
  chapter,
  goldenFinger,
  worldRules,
  className,
}: {
  chapter: Chapter | null
  goldenFinger: string | null
  worldRules: { category: string; title: string; content: string }[]
  className?: string
}) {
  if (!chapter) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="px-4 py-3 flex items-center gap-2 border-b">
          <Eye className="size-4 text-purple-600 dark:text-purple-400" />
          <h3 className="text-sm font-semibold text-foreground">写作参考</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6">
          选择章节后查看参考信息
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="px-4 py-3 flex items-center gap-2 border-b">
        <Eye className="size-4 text-purple-600 dark:text-purple-400" />
        <h3 className="text-sm font-semibold text-foreground">写作参考</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {chapter.summary && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookMarked className="size-3.5 text-amber-500" />
                <span className="text-xs font-medium text-foreground">章节摘要</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed bg-amber-500/5 border border-amber-500/10 rounded-md p-2.5">
                {chapter.summary}
              </p>
            </div>
          )}

          {chapter.storyBeats.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="size-3.5 text-purple-500" />
                <span className="text-xs font-medium text-foreground">故事节拍</span>
              </div>
              <div className="space-y-1.5">
                {chapter.storyBeats.map((beat) => {
                  const beatType = beat.type as BeatType
                  return (
                    <div
                      key={beat.id}
                      className={cn(
                        'rounded-md border px-2.5 py-2',
                        BEAT_BG_COLORS[beatType]
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={cn(
                            'inline-block size-1.5 rounded-full',
                            BEAT_DOT_COLORS[beatType]
                          )}
                        />
                        <span
                          className={cn(
                            'text-[10px] font-medium',
                            BEAT_TEXT_COLORS[beatType]
                          )}
                        >
                          {BEAT_TYPE_LABELS[beatType] || beat.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {beat.content}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {goldenFinger && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-foreground">金手指</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed bg-amber-500/5 border border-amber-500/10 rounded-md p-2.5">
                  {goldenFinger}
                </p>
              </div>
            </>
          )}

          {worldRules.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Globe className="size-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-foreground">世界规则</span>
              </div>
              <div className="space-y-1.5">
                {worldRules.map((rule, idx) => (
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
                      <span className="font-medium text-foreground">
                        {rule.title}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {rule.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!chapter.summary && chapter.storyBeats.length === 0 && !goldenFinger && worldRules.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="size-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">暂无参考信息</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── AI Assist Result Panel ──────────────────────────────────────────────────

function AIAssistPanel({
  result,
  suggestions,
  mode,
  isLoading,
  onApply,
  onDiscard,
}: {
  result: string | null
  suggestions: SuggestionItem[] | null
  mode: AIAssistMode | null
  isLoading: boolean
  onApply: () => void
  onDiscard: () => void
}) {
  if (!result && !isLoading) return null

  return (
    <div className="border-t bg-muted/30 shrink-0">
      <div className="px-4 py-2 flex items-center gap-2 border-b bg-background/80">
        <Wand2 className="size-3.5 text-emerald-500" />
        <span className="text-xs font-medium text-foreground">
          {mode === 'continue' ? 'AI 续写' :
           mode === 'rewrite' ? 'AI 改写' :
           mode === 'suggest' ? 'AI 建议' :
           mode === 'dialogue' ? 'AI 对话' : 'AI 辅助'}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {result && !isLoading && (
            <>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-muted-foreground" onClick={onDiscard}>
                <RotateCcw className="size-3" />
                放弃
              </Button>
              <Button size="sm" className="h-6 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onApply}>
                <Check className="size-3" />
                {mode === 'rewrite' ? '替换选区' : mode === 'suggest' ? '采纳并续写' : '采纳'}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="max-h-[250px] overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 className="size-4 animate-spin text-emerald-500" />
            <span className="text-xs text-muted-foreground">AI 正在创作中...</span>
          </div>
        ) : suggestions && suggestions.length > 0 ? (
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
              </div>
            ))}
          </div>
        ) : result ? (
          <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-serif"
            style={{ fontFamily: '"Noto Serif SC", "Source Han Serif CN", "STSong", Georgia, serif' }}
          >
            {result}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── Main Component: WritingSpace ────────────────────────────────────────────

export default function WritingSpace() {
  const {
    currentProject,
    activeChapterId,
    setActiveChapterId,
    focusMode,
    toggleFocusMode,
    pendingAdopt,
    consumeAdopt,
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

  // Derived
  const chapters = currentProject?.chapters ?? []
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

  // ─── Handle adopt from Hermes ────────────────────────────────────────────────

  useEffect(() => {
    if (!pendingAdopt) return
    if (pendingAdopt.type === 'chapter_content' && pendingAdopt.chapterId === activeChapterId) {
      if (pendingAdopt.mode === 'append') {
        setContent(prev => prev + '\n' + pendingAdopt.content)
        toast.success('AI内容已采纳并追加')
      } else {
        setContent(pendingAdopt.content)
        toast.success('AI内容已采纳')
      }
      consumeAdopt()
    }
  }, [pendingAdopt, activeChapterId, consumeAdopt])

  // ─── Sync local state when active chapter changes ───────────────────────

  useEffect(() => {
    if (activeChapter) {
      setTitle(activeChapter.title || '')
      setContent(activeChapter.content || '')
      lastSavedContentRef.current = activeChapter.content || ''
      lastSavedTitleRef.current = activeChapter.title || ''
      setSaveStatus('idle')
    } else {
      setTitle('')
      setContent('')
      lastSavedContentRef.current = ''
      lastSavedTitleRef.current = ''
      setSaveStatus('idle')
    }
    // Clear AI state on chapter switch
    setAiResult(null)
    setAiSuggestions(null)
    setAiMode(null)
  }, [activeChapterId])

  // ─── Auto-select first chapter if none selected ─────────────────────────

  useEffect(() => {
    if (currentProject && chapters.length > 0 && !activeChapterId) {
      setActiveChapterId(sortedChapters[0].id)
    }
  }, [currentProject, chapters.length, activeChapterId, sortedChapters, setActiveChapterId])

  // ─── Save chapter to API ────────────────────────────────────────────────

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

  // ─── Debounced auto-save ────────────────────────────────────────────────

  const debouncedSave = useCallback(
    (chapterId: string, newTitle: string, newContent: string, newWordCount: number, status: string) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = setTimeout(() => {
        saveChapter(chapterId, {
          title: newTitle,
          content: newContent,
          wordCount: newWordCount,
          status,
        })
        lastSavedContentRef.current = newContent
        lastSavedTitleRef.current = newTitle
      }, 1000)
    },
    [saveChapter]
  )

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  // ─── Get selected text from textarea ─────────────────────────────────────

  const getSelectedText = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return ''
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    if (start === end) return ''
    return content.substring(start, end)
  }, [content])

  // ─── AI Assist: Call API ────────────────────────────────────────────────

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

      if (data.suggestions) {
        setAiSuggestions(data.suggestions)
      }
      setAiResult(data.result)
    } catch (err) {
      toast.error('AI辅助请求失败')
      console.error('AI assist error:', err)
    } finally {
      setAiLoading(false)
    }
  }, [currentProject, activeChapterId, content, getSelectedText])

  // ─── Apply AI result ────────────────────────────────────────────────────

  const handleApplyAI = useCallback(() => {
    if (!aiResult) return

    if (aiMode === 'rewrite' && selectedText) {
      // Replace selected text with AI result
      const textarea = textareaRef.current
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newContent = content.substring(0, start) + aiResult + content.substring(end)
        setContent(newContent)
        const newWordCount = countWords(newContent)
        if (activeChapterId && activeChapter) {
          debouncedSave(activeChapterId, title, newContent, newWordCount, activeChapter.status)
        }
      }
    } else if (aiMode === 'suggest') {
      // For suggestions, just append the result text
      const newContent = content + '\n' + aiResult
      setContent(newContent)
      const newWordCount = countWords(newContent)
      if (activeChapterId && activeChapter) {
        debouncedSave(activeChapterId, title, newContent, newWordCount, activeChapter.status)
      }
    } else {
      // Continue / dialogue: append
      const newContent = content + '\n' + aiResult
      setContent(newContent)
      const newWordCount = countWords(newContent)
      if (activeChapterId && activeChapter) {
        debouncedSave(activeChapterId, title, newContent, newWordCount, activeChapter.status)
      }
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

  // ─── Content change handler ─────────────────────────────────────────────

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value
      setContent(newContent)
      if (activeChapterId && activeChapter) {
        const newWordCount = countWords(newContent)
        debouncedSave(activeChapterId, title, newContent, newWordCount, activeChapter.status)
      }
    },
    [activeChapterId, activeChapter, title, debouncedSave]
  )

  // ─── Title change handler ───────────────────────────────────────────────

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

  // ─── Status toggle ──────────────────────────────────────────────────────

  const handleStatusToggle = useCallback(() => {
    if (!activeChapterId || !activeChapter) return
    const newStatus = activeChapter.status === 'completed' ? 'draft' : 'completed'
    saveChapter(activeChapterId, {
      title,
      content,
      wordCount,
      status: newStatus,
    })
  }, [activeChapterId, activeChapter, title, content, wordCount, saveChapter])

  // ─── Chapter navigation ─────────────────────────────────────────────────

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

  // ─── Chapter selection (from sidebar) ───────────────────────────────────

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

  // ─── Empty State: No project ────────────────────────────────────────────

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

  // ─── Empty State: No chapters ───────────────────────────────────────────

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <FileText className="size-8 opacity-40" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">暂无章节</h3>
        <p className="text-sm text-center max-w-xs">
          请先在大纲推演中创建章节，然后返回创作空间开始写作
        </p>
      </div>
    )
  }

  // ─── Save status indicator ──────────────────────────────────────────────

  const SaveIndicator = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <Loader2 className="size-3 animate-spin" />
            保存中...
          </span>
        )
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="size-3" />
            已保存
          </span>
        )
      case 'error':
        return (
          <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
            <Save className="size-3" />
            保存失败
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <PenLine className="size-3" />
            未修改
          </span>
        )
    }
  }

  // ─── Left Sidebar Content ──────────────────────────────────────────────

  const leftSidebarContent = (
    <ChapterDirectory
      chapters={chapters}
      activeChapterId={activeChapterId}
      onSelectChapter={handleSelectChapter}
    />
  )

  // ─── Right Sidebar Content ──────────────────────────────────────────────

  const rightSidebarContent = (
    <ChapterReference
      chapter={activeChapter}
      goldenFinger={currentProject.goldenFinger}
      worldRules={currentProject.worldRules.map((r) => ({
        category: r.category,
        title: r.title,
        content: r.content,
      }))}
    />
  )

  // ─── Top Toolbar ────────────────────────────────────────────────────────

  const TopToolbar = () => (
    <div className="flex items-center gap-1 px-3 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
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
            {leftSidebarContent}
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

      {/* ─── AI Assist Buttons ─── */}
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
        <TooltipContent side="bottom">AI续写 - 根据上下文续写内容</TooltipContent>
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
        <TooltipContent side="bottom">AI改写 - 选中文字后点击改写</TooltipContent>
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
        <TooltipContent side="bottom">AI生成对话 - 根据角色生成对话</TooltipContent>
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
          <TooltipContent side="bottom">AI建议 - 获取写作方向建议</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-auto p-2" side="bottom" align="start">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => callAIAssist('suggest')}>
              <Lightbulb className="size-3.5 text-purple-500" />
              获取写作方向建议
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => callAIAssist('continue')}>
              <Wand2 className="size-3.5 text-emerald-500" />
              AI续写下一段
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => callAIAssist('dialogue')}>
              <MessageCircle className="size-3.5 text-amber-500" />
              生成角色对话
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

      {/* Right side: save indicator + word count */}
      <div className="ml-auto flex items-center gap-3">
        <SaveIndicator />
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            本章 <span className="font-medium text-foreground tabular-nums">{formatWordCount(wordCount)}</span> 字
          </span>
          <span className="text-xs text-muted-foreground/50">|</span>
          <span className="text-xs text-muted-foreground">
            全书 <span className="font-medium text-foreground tabular-nums">{formatWordCount(totalWordCount)}</span> 字
          </span>
        </div>
      </div>
    </div>
  )

  // ─── Center: Writing Area ───────────────────────────────────────────────

  const WritingArea = () => (
    <div className="flex flex-col h-full">
      {/* Manuscript area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div
            className={cn(
              'max-w-3xl mx-auto px-6 sm:px-10 lg:px-16 py-8 min-h-full',
              'bg-[#faf9f6] dark:bg-[#1a1a1a]',
              'transition-colors duration-300'
            )}
          >
            {/* Chapter title */}
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="章节标题..."
              className={cn(
                'w-full bg-transparent border-none outline-none',
                'text-2xl sm:text-3xl font-bold text-foreground/90 dark:text-foreground/80',
                'placeholder:text-muted-foreground/30',
                'pb-4 mb-6',
                'border-b border-border/30'
              )}
              style={{ borderBottom: '1px solid var(--border-opacity-20, rgba(128,128,128,0.15))' }}
            />

            {/* Writing content */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="开始你的创作..."
              className={cn(
                'w-full bg-transparent border-none outline-none resize-none',
                'text-base sm:text-lg leading-[1.9] tracking-wide',
                'text-foreground/85 dark:text-foreground/75',
                'placeholder:text-muted-foreground/25',
                'min-h-[60vh]',
                'font-serif'
              )}
              style={{
                fontFamily:
                  '"Noto Serif SC", "Source Han Serif CN", "STSong", Georgia, "Times New Roman", serif',
              }}
            />
          </div>
        </ScrollArea>
      </div>

      {/* AI Assist Result Panel */}
      <AIAssistPanel
        result={aiResult}
        suggestions={aiSuggestions}
        mode={aiMode}
        isLoading={aiLoading}
        onApply={handleApplyAI}
        onDiscard={handleDiscardAI}
      />
    </div>
  )

  // ─── Focus Mode Overlay ─────────────────────────────────────────────────

  const FocusModeOverlay = () => {
    if (!focusMode) return null
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFocusMode}
          className={cn(
            'shadow-lg backdrop-blur-md',
            'bg-background/80 border-border/50',
            'hover:bg-background',
            'transition-all duration-200',
            'gap-2'
          )}
        >
          <Minimize2 className="size-3.5" />
          退出专注模式
          <kbd className="pointer-events-none ml-1 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            Esc
          </kbd>
        </Button>
        {/* Quick AI assist in focus mode */}
        <Button
          variant="outline"
          size="sm"
          className="shadow-lg backdrop-blur-md bg-background/80 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 gap-2"
          onClick={() => callAIAssist('continue')}
          disabled={aiLoading}
        >
          {aiLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          AI续写
        </Button>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Top Toolbar */}
      <TopToolbar />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left sidebar - Chapter Directory */}
        {!focusMode && !isMobile && (
          <div className="w-64 border-r bg-background/50 shrink-0">
            {leftSidebarContent}
          </div>
        )}

        {/* Center - Writing Area */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <WritingArea />
        </div>

        {/* Right sidebar - Chapter Reference */}
        {!focusMode && !isMobile && (
          <div className="w-72 border-l bg-background/50 shrink-0">
            {rightSidebarContent}
          </div>
        )}
      </div>

      {/* Focus mode floating buttons */}
      <FocusModeOverlay />
    </div>
  )
}
