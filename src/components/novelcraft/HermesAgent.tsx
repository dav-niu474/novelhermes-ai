'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import type { HermesMessage, HermesAction, AppTab } from '@/lib/types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

import {
  MessageSquare,
  Send,
  X,
  Trash2,
  Loader2,
  Sparkles,
  BookOpen,
  Wand2,
  Lightbulb,
  Shield,
  CheckCircle2,
  AlertCircle,
  Zap,
  GitBranch,
  PenLine,
  ArrowRight,
  Globe,
} from 'lucide-react'

// ─── Quick Action Presets (creation workflow) ────────────────────────────────

const QUICK_ACTIONS = [
  { icon: <Sparkles className="size-3.5" />, label: '一键创作', prompt: '请帮我完成从灵感到大纲的完整创作流程：先用"赛博朋克+修仙"作为灵感关键词生成设定，然后推演大纲' },
  { icon: <Lightbulb className="size-3.5" />, label: '灵感瓶颈', prompt: '我遇到了创作瓶颈，请根据当前项目设定给我一些灵感突破点和新方向' },
  { icon: <Shield className="size-3.5" />, label: '一致性检查', prompt: '请检查当前项目的角色设定和世界观是否存在逻辑矛盾或不一致的地方' },
  { icon: <Zap className="size-3.5" />, label: '项目诊断', prompt: '请分析当前项目的创作进度，告诉我还缺少什么，建议下一步操作' },
  { icon: <Wand2 className="size-3.5" />, label: '写章草稿', prompt: '请为第一章生成草稿正文' },
  { icon: <GitBranch className="size-3.5" />, label: '推演大纲', prompt: '请基于当前设定推演前5章大纲' },
]

// ─── Action Status Icon ──────────────────────────────────────────────────────

function ActionBadge({ action }: { action: HermesAction }) {
  const iconMap: Record<string, React.ReactNode> = {
    generate_spark: <Sparkles className="size-3" />,
    generate_outline: <GitBranch className="size-3" />,
    add_character: <BookOpen className="size-3" />,
    add_world_rule: <Globe className="size-3" />,
    write_chapter_draft: <PenLine className="size-3" />,
    navigate_to: <ArrowRight className="size-3" />,
    analyze_project_state: <Zap className="size-3" />,
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        action.status === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        action.status === 'running' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
        action.status === 'error' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
      )}
    >
      {action.status === 'running' && <Loader2 className="size-3 animate-spin" />}
      {action.status === 'success' && <CheckCircle2 className="size-3" />}
      {action.status === 'error' && <AlertCircle className="size-3" />}
      {iconMap[action.type] || <Zap className="size-3" />}
      <span>{action.label}</span>
    </div>
  )
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: HermesMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('px-4', isUser ? '' : '')}>
      <div className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
        {!isUser && (
          <div className="shrink-0 mt-1">
            <div className="size-7 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center shadow-sm">
              <MessageSquare className="size-3.5 text-white" />
            </div>
          </div>
        )}

        <div className="max-w-[85%] min-w-0">
          {/* Text bubble */}
          <div
            className={cn(
              'rounded-2xl px-4 py-3 text-sm leading-relaxed',
              isUser
                ? 'bg-emerald-600 text-white rounded-br-md'
                : 'bg-muted/80 text-foreground rounded-bl-md border border-border/30'
            )}
          >
            <div className="whitespace-pre-wrap break-words">
              {message.content.split('\n').map((line, i) => {
                const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                return (
                  <span key={i}>
                    {i > 0 && <br />}
                    <span dangerouslySetInnerHTML={{ __html: formattedLine }} />
                  </span>
                )
              })}
            </div>
            <div className={cn('text-[10px] mt-1.5 opacity-50', isUser ? 'text-right' : 'text-left')}>
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Action badges */}
          {message.actions && message.actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {message.actions.map((action, i) => (
                <ActionBadge key={i} action={action} />
              ))}
            </div>
          )}
        </div>

        {isUser && (
          <div className="shrink-0 mt-1">
            <div className="size-7 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-sm">
              <span className="text-[10px] font-bold text-white">你</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Welcome Screen ──────────────────────────────────────────────────────────

function WelcomeScreen({ onQuickAction }: { onQuickAction: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-5 py-6 text-center">
      <div className="relative mb-5">
        <div className="size-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-amber-500/20 to-rose-500/20 border border-border/30 flex items-center justify-center">
          <MessageSquare className="size-8 text-emerald-500/70" />
        </div>
        <div className="absolute -top-1 -right-1 size-3 rounded-full bg-amber-400 animate-pulse" />
      </div>

      <h3 className="text-lg font-bold text-foreground mb-1">Hermes 创作引导</h3>
      <p className="text-xs text-muted-foreground max-w-[240px] mb-5 leading-relaxed">
        不仅能聊天，还能直接帮你生成灵感、推演大纲、创建角色、写章节草稿
      </p>

      <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onQuickAction(action.prompt)}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-border/40 bg-card/50 hover:bg-accent/50 transition-colors text-left group"
          >
            <span className="text-muted-foreground group-hover:text-emerald-500 transition-colors shrink-0">
              {action.icon}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component: HermesAgent ─────────────────────────────────────────────

export default function HermesAgent() {
  const {
    currentProject,
    hermesOpen,
    setHermesOpen,
    hermesMessages,
    addHermesMessage,
    clearHermesMessages,
    hermesLoading,
    setHermesLoading,
    setCurrentProject,
    setActiveTab,
    setActiveChapterId,
    refreshProject,
  } = useAppStore()

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [hermesMessages, hermesLoading])

  // Focus textarea
  useEffect(() => {
    if (hermesOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [hermesOpen])

  // ─── Process Hermes response (handle actions, navigation, project sync) ───

  const processResponse = useCallback(
    (data: { response: string; timestamp: string; actions?: { type: string; label: string; status: string; detail?: string; navigateTo?: string }[]; project?: unknown }) => {
      const assistantMessage: HermesMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp || new Date().toISOString(),
        actions: data.actions?.map((a) => ({
          type: a.type as HermesAction['type'],
          label: a.label,
          status: a.status as HermesAction['status'],
          detail: a.detail,
        })),
      }
      addHermesMessage(assistantMessage)

      // Update project if returned
      if (data.project) {
        setCurrentProject(data.project as Parameters<typeof setCurrentProject>[0])
      }

      // Handle navigation
      if (data.actions) {
        for (const action of data.actions) {
          if (action.navigateTo) {
            setActiveTab(action.navigateTo as AppTab)
          }
          // If a chapter draft was written, set the active chapter
          if (action.type === 'write_chapter_draft' && action.status === 'success') {
            // Refresh project to get the latest data
            refreshProject()
          }
        }
      }
    },
    [addHermesMessage, setCurrentProject, setActiveTab, refreshProject]
  )

  // ─── Send message ───────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !currentProject) return

      const userMessage: HermesMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      }

      addHermesMessage(userMessage)
      setInput('')
      setHermesLoading(true)

      try {
        const history = hermesMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const res = await fetch('/api/ai/hermes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: currentProject.id,
            message: text.trim(),
            history,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || '对话失败')
        }

        processResponse(data)
      } catch (err) {
        console.error('Hermes chat error:', err)
        addHermesMessage({
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: '抱歉，我暂时无法回应。请稍后再试。',
          timestamp: new Date().toISOString(),
        })
      } finally {
        setHermesLoading(false)
      }
    },
    [currentProject, hermesMessages, addHermesMessage, setHermesLoading, processResponse]
  )

  const handleSend = useCallback(() => {
    sendMessage(input)
  }, [input, sendMessage])

  // Quick action handler
  const handleQuickAction = useCallback(
    (prompt: string) => {
      sendMessage(prompt)
    },
    [sendMessage]
  )

  // Key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // No project state
  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
        <div className="size-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <BookOpen className="size-6 text-muted-foreground/50" />
        </div>
        <h3 className="text-sm font-semibold text-foreground/80 mb-1">请先选择项目</h3>
        <p className="text-xs text-muted-foreground">
          选择或创建一个项目后，Hermes 将拥有项目记忆并引导创作
        </p>
      </div>
    )
  }

  const hasMessages = hermesMessages.length > 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Header ── */}
      <div className="shrink-0 px-4 py-3 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center shadow-sm">
              <MessageSquare className="size-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Hermes</h3>
              <p className="text-[10px] text-muted-foreground">创作引导 · 可执行操作</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {hasMessages && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={clearHermesMessages}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>清空对话</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground md:hidden"
                  onClick={() => setHermesOpen(false)}
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>关闭面板</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Project indicator */}
        <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/5 border border-emerald-500/10">
          <BookOpen className="size-3 text-emerald-500" />
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
            {currentProject.title}
          </span>
        </div>
      </div>

      {/* ── Messages Area ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-4">
        {!hasMessages ? (
          <WelcomeScreen onQuickAction={handleQuickAction} />
        ) : (
          <>
            {hermesMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Loading indicator */}
            {hermesLoading && (
              <div className="flex gap-2.5 px-4">
                <div className="shrink-0 mt-1">
                  <div className="size-7 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center">
                    <MessageSquare className="size-3.5 text-white" />
                  </div>
                </div>
                <div className="bg-muted/80 rounded-2xl rounded-bl-md border border-border/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin text-emerald-500" />
                    <span className="text-xs text-muted-foreground">Hermes 正在思考与执行...</span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    <span className="size-1.5 rounded-full bg-emerald-500/40 animate-bounce [animation-delay:0ms]" />
                    <span className="size-1.5 rounded-full bg-amber-500/40 animate-bounce [animation-delay:150ms]" />
                    <span className="size-1.5 rounded-full bg-rose-500/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Quick Actions (when messages exist) ── */}
      {hasMessages && !hermesLoading && (
        <div className="shrink-0 px-4 py-1.5 border-t border-border/30">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border/40 bg-card/50 hover:bg-accent/50 transition-colors shrink-0"
              >
                <span className="text-muted-foreground">{action.icon}</span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input Area ── */}
      <div className="shrink-0 px-4 py-3 border-t bg-background/95">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="告诉我你想要什么，我会直接执行..."
              className="min-h-[40px] max-h-[120px] resize-none text-sm pr-2 bg-muted/30 border-border/40 focus-visible:border-emerald-500/40 focus-visible:ring-emerald-500/10"
              rows={1}
              disabled={hermesLoading}
            />
          </div>
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || hermesLoading}
            className={cn(
              'size-9 shrink-0 rounded-lg transition-all',
              input.trim() && !hermesLoading
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {hermesLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  )
}
