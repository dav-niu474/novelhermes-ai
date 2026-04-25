'use client'

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import type { HermesMessage } from '@/lib/types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
  ChevronDown,
  RotateCcw,
} from 'lucide-react'

// ─── Quick Action Presets ────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: <Lightbulb className="size-3.5" />, label: '灵感瓶颈', prompt: '我遇到了创作瓶颈，请根据当前项目设定给我一些灵感突破点和新方向' },
  { icon: <Shield className="size-3.5" />, label: '一致性检查', prompt: '请检查当前项目的角色设定和世界观是否存在逻辑矛盾或不一致的地方' },
  { icon: <Wand2 className="size-3.5" />, label: '情节发展', prompt: '请帮我推演接下来的情节走向，给出2-3个可能的发展方向' },
  { icon: <Sparkles className="size-3.5" />, label: '角色深化', prompt: '请帮我深化主角的角色弧光，设计更丰富的内心冲突和成长路径' },
]

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: HermesMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-2.5 px-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="shrink-0 mt-1">
          <div className="size-7 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center shadow-sm">
            <MessageSquare className="size-3.5 text-white" />
          </div>
        </div>
      )}

      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-emerald-600 text-white rounded-br-md'
            : 'bg-muted/80 text-foreground rounded-bl-md border border-border/30'
        )}
      >
        {/* Render message content with basic markdown-like formatting */}
        <div className="whitespace-pre-wrap break-words">
          {message.content.split('\n').map((line, i) => {
            // Bold text
            const formattedLine = line.replace(
              /\*\*(.*?)\*\*/g,
              '<strong>$1</strong>'
            )
            return (
              <span key={i}>
                {i > 0 && <br />}
                <span dangerouslySetInnerHTML={{ __html: formattedLine }} />
              </span>
            )
          })}
        </div>
        <div
          className={cn(
            'text-[10px] mt-1.5 opacity-50',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      {isUser && (
        <div className="shrink-0 mt-1">
          <div className="size-7 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-sm">
            <span className="text-[10px] font-bold text-white">你</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Welcome Screen ──────────────────────────────────────────────────────────

function WelcomeScreen({ onQuickAction }: { onQuickAction: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8 text-center">
      <div className="relative mb-5">
        <div className="size-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-amber-500/20 to-rose-500/20 border border-border/30 flex items-center justify-center">
          <MessageSquare className="size-8 text-emerald-500/70" />
        </div>
        {/* Orbiting dot */}
        <div className="absolute -top-1 -right-1 size-3 rounded-full bg-amber-400 animate-pulse" />
      </div>

      <h3 className="text-lg font-bold text-foreground mb-1">Hermes 创作顾问</h3>
      <p className="text-sm text-muted-foreground max-w-[260px] mb-6 leading-relaxed">
        你的 AI 创作伙伴，拥有项目完整记忆，随时提供灵感、检查一致性、推演情节
      </p>

      <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onQuickAction(action.prompt)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/40 bg-card/50 hover:bg-accent/50 transition-colors text-left group"
          >
            <span className="text-muted-foreground group-hover:text-emerald-500 transition-colors">
              {action.icon}
            </span>
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
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
  } = useAppStore()

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [hermesMessages, hermesLoading])

  // Focus textarea when panel opens
  useEffect(() => {
    if (hermesOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [hermesOpen])

  // Send message to Hermes
  const handleSend = useCallback(async () => {
    if (!input.trim() || hermesLoading || !currentProject) return

    const userMessage: HermesMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    addHermesMessage(userMessage)
    setInput('')
    setHermesLoading(true)

    try {
      // Build history from existing messages (exclude system messages)
      const history = hermesMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/ai/hermes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          message: userMessage.content,
          history,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '对话失败')
      }

      const assistantMessage: HermesMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp || new Date().toISOString(),
      }

      addHermesMessage(assistantMessage)
    } catch (err) {
      console.error('Hermes chat error:', err)
      const errorMessage: HermesMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: '抱歉，我暂时无法回应。请稍后再试。',
        timestamp: new Date().toISOString(),
      }
      addHermesMessage(errorMessage)
    } finally {
      setHermesLoading(false)
    }
  }, [input, hermesLoading, currentProject, hermesMessages, addHermesMessage, setHermesLoading])

  // Quick action handler
  const handleQuickAction = useCallback(
    (prompt: string) => {
      setInput(prompt)
      // Auto-send after a brief delay
      setTimeout(() => {
        const userMessage: HermesMessage = {
          id: `msg-${Date.now()}-user`,
          role: 'user',
          content: prompt,
          timestamp: new Date().toISOString(),
        }
        addHermesMessage(userMessage)
        setHermesLoading(true)

        const history = hermesMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        fetch('/api/ai/hermes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: currentProject?.id,
            message: prompt,
            history,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.response) {
              addHermesMessage({
                id: `msg-${Date.now()}-assistant`,
                role: 'assistant',
                content: data.response,
                timestamp: data.timestamp || new Date().toISOString(),
              })
            }
          })
          .catch(() => {
            addHermesMessage({
              id: `msg-${Date.now()}-error`,
              role: 'assistant',
              content: '抱歉，我暂时无法回应。请稍后再试。',
              timestamp: new Date().toISOString(),
            })
          })
          .finally(() => {
            setHermesLoading(false)
          })
      }, 100)
    },
    [currentProject, hermesMessages, addHermesMessage, setHermesLoading]
  )

  // Handle key press
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
          选择或创建一个项目后，Hermes 将拥有项目记忆
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
              <p className="text-[10px] text-muted-foreground">创作顾问 · 项目记忆已激活</p>
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
                    <span className="text-xs text-muted-foreground">Hermes 正在思考...</span>
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
              placeholder="向 Hermes 提问..."
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
