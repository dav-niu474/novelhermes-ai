'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import type { HermesMessage, HermesAction, AppTab } from '@/lib/types'
import type { AdoptTarget } from '@/lib/store'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

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
  Target,
  ChevronRight,
  Check,
  ClipboardCheck,
  RefreshCw,
  BookMarked,
  Search,
  Palette,
} from 'lucide-react'

// ─── Workflow Stage Config ────────────────────────────────────────────────────

const WORKFLOW_STAGES = [
  { key: 'spark', label: '灵感', icon: <Sparkles className="size-3" /> },
  { key: 'architecture', label: '架构', icon: <Shield className="size-3" /> },
  { key: 'outline', label: '大纲', icon: <GitBranch className="size-3" /> },
  { key: 'writing', label: '创作', icon: <PenLine className="size-3" /> },
] as const

// ─── Context-Aware Quick Actions ─────────────────────────────────────────────

interface QuickActionDef {
  icon: React.ReactNode
  label: string
  prompt: string
  stage?: string
}

const QUICK_ACTIONS: QuickActionDef[] = [
  { icon: <Target className="size-3.5" />, label: '下一步', prompt: '请分析当前项目状态，告诉我下一步应该做什么', stage: 'any' },
  { icon: <Sparkles className="size-3.5" />, label: '灵感生成', prompt: '请帮我用灵感关键词生成小说设定', stage: 'spark' },
  { icon: <Lightbulb className="size-3.5" />, label: '灵感瓶颈', prompt: '我遇到了创作瓶颈，请根据当前项目设定给我一些灵感突破点和新方向', stage: 'architecture' },
  { icon: <Shield className="size-3.5" />, label: '一致性检查', prompt: '请检查当前项目的角色设定和世界观是否存在逻辑矛盾或不一致的地方', stage: 'architecture' },
  { icon: <Zap className="size-3.5" />, label: '项目诊断', prompt: '请分析当前项目的创作进度，告诉我还缺少什么，建议下一步操作', stage: 'any' },
  { icon: <GitBranch className="size-3.5" />, label: '推演大纲', prompt: '请基于当前设定推演前5章大纲', stage: 'outline' },
  { icon: <Wand2 className="size-3.5" />, label: '写章草稿', prompt: '请为第一章生成草稿正文', stage: 'writing' },
  // Wangwen-Creative Skill Actions
  { icon: <Search className="size-3.5" />, label: '拆文分析', prompt: '请帮我做拆文分析，我想学习优秀网文的创作方法', stage: 'any' },
  { icon: <Palette className="size-3.5" />, label: '金手指设计', prompt: '请为我的项目设计3个差异化的金手指方案', stage: 'architecture' },
  { icon: <BookMarked className="size-3.5" />, label: '创作方向', prompt: '我不知道写什么类型的网文，请推荐3个差异化方向', stage: 'spark' },
]

// ─── Adopt Button for Assistant Messages ──────────────────────────────────────

function AdoptButton({ message, onAdopt }: { message: HermesMessage; onAdopt: (target: AdoptTarget) => void }) {
  // Parse the message content for adoptable suggestions
  const getAdoptOptions = (): { label: string; target: AdoptTarget }[] => {
    const options: { label: string; target: AdoptTarget }[] = []
    const content = message.content

    // Try to detect structured content in the message
    // 1. Look for project field suggestions (书名/简介/金手指/世界观)
    const fieldPatterns: { pattern: RegExp; field: string; label: string }[] = [
      { pattern: /(?:书名|标题)[：:]\s*["「『]?(.+?)["」』]?$/m, field: 'title', label: '采纳书名' },
      { pattern: /(?:简介|一句话简介)[：:]\s*["「『]?(.+?)["」』]?$/m, field: 'synopsis', label: '采纳简介' },
      { pattern: /(?:金手指|核心能力)[：:]\s*["「『]?(.+?)["」』]?$/m, field: 'goldenFinger', label: '采纳金手指' },
      { pattern: /(?:世界观|世界观背景)[：:]\s*["「『]?(.+?)["」』]?$/m, field: 'worldBackground', label: '采纳世界观' },
    ]

    for (const { pattern, field, label } of fieldPatterns) {
      const match = content.match(pattern)
      if (match && match[1]) {
        options.push({
          label,
          target: { type: 'project_field', field, value: match[1].trim() },
        })
      }
    }

    // 2. Look for character suggestions
    if (content.includes('角色') && (content.includes('性格') || content.includes('背景'))) {
      // Try to parse character info from the message
      const charNameMatch = content.match(/(?:角色名?|名称)[：:]\s*["「『]?(.+?)["」』]?$/m)
      const charRoleMatch = content.match(/(?:类型|角色类型)[：:]\s*(主角|反派|配角)/m)
      const charPersMatch = content.match(/(?:性格|性格特质)[：:]\s*(.+?)$/m)
      const charBgMatch = content.match(/(?:背景|背景档案)[：:]\s*(.+?)$/m)
      const charConflictMatch = content.match(/(?:冲突|核心冲突)[：:]\s*(.+?)$/m)

      if (charNameMatch) {
        options.push({
          label: `采纳角色「${charNameMatch[1].trim()}」`,
          target: {
            type: 'character',
            character: {
              name: charNameMatch[1].trim(),
              role: charRoleMatch?.[1] || '配角',
              personality: charPersMatch?.[1]?.trim() || '',
              background: charBgMatch?.[1]?.trim() || '',
              conflict: charConflictMatch?.[1]?.trim() || '',
            },
          },
        })
      }
    }

    // 3. Look for world rule suggestions
    if (content.includes('世界规则') || content.includes('规则锚点')) {
      const ruleTitleMatch = content.match(/(?:规则标题?|规则名)[：:]\s*["「『]?(.+?)["」』]?$/m)
      const ruleCatMatch = content.match(/(?:分类|规则分类)[：:]\s*(基础规则|力量体系|社会结构|地理环境|历史设定)/m)
      const ruleContentMatch = content.match(/(?:规则内容|内容)[：:]\s*(.+?)$/m)

      if (ruleTitleMatch) {
        options.push({
          label: `采纳规则「${ruleTitleMatch[1].trim()}」`,
          target: {
            type: 'world_rule',
            rule: {
              category: ruleCatMatch?.[1] || '基础规则',
              title: ruleTitleMatch[1].trim(),
              content: ruleContentMatch?.[1]?.trim() || '',
            },
          },
        })
      }
    }

    // 4. For writing content in writing mode
    // Detect if we're in writing mode and the message has substantial text
    const activeTab = useAppStore.getState().activeTab
    const currentProject = useAppStore.getState().currentProject
    if (activeTab === 'writing' && currentProject && content.length > 100) {
      const activeChapterId = useAppStore.getState().activeChapterId
      if (activeChapterId) {
        // Only offer to adopt if the content looks like story text
        const hasDialogue = /["「『"].+?["」』"]/.test(content)
        const hasNarrative = content.length > 150
        if (hasDialogue || hasNarrative) {
          options.push({
            label: '采纳到当前章节',
            target: {
              type: 'chapter_content',
              chapterId: activeChapterId,
              content: content.replace(/^[^：:\n]*[：:]\s*/gm, '').trim(), // Remove labels
              mode: 'append',
            },
          })
        }
      }
    }

    return options
  }

  const adoptOptions = getAdoptOptions()

  if (adoptOptions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {adoptOptions.map((opt, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          className="h-6 text-[10px] gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          onClick={() => onAdopt(opt.target)}
        >
          <ClipboardCheck className="size-3" />
          {opt.label}
        </Button>
      ))}
    </div>
  )
}

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
    validate_readiness: <Shield className="size-3" />,
    suggest_next_step: <Target className="size-3" />,
    search_novel: <Search className="size-3" />,
    deconstruct_novel: <BookMarked className="size-3" />,
    generate_genre_outline: <GitBranch className="size-3" />,
    design_golden_finger: <Wand2 className="size-3" />,
    creative_consultation: <Palette className="size-3" />,
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

// ─── Workflow Progress Mini ──────────────────────────────────────────────────

function WorkflowMiniProgress({ project }: { project: { title: string; spark: string; synopsis: string | null; goldenFinger: string | null; worldBackground: string | null; characters: unknown[]; worldRules: unknown[]; chapters: unknown[] } }) {
  const hasSpark = !!(project.title && project.title !== '未命名项目' && project.spark)
  const hasArchitecture = hasSpark && !!(project.synopsis && project.goldenFinger && project.worldBackground && project.characters.length > 0)
  const hasOutline = hasArchitecture && project.chapters.length > 0

  let activeStage = 0
  if (hasOutline) activeStage = 3
  else if (hasArchitecture) activeStage = 2
  else if (hasSpark) activeStage = 1

  return (
    <div className="flex items-center gap-1">
      {WORKFLOW_STAGES.map((stage, i) => (
        <React.Fragment key={stage.key}>
          <div
            className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors',
              i <= activeStage
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : i === activeStage + 1
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-muted/50 text-muted-foreground/50',
            )}
          >
            {stage.icon}
            <span className="hidden sm:inline">{stage.label}</span>
          </div>
          {i < WORKFLOW_STAGES.length - 1 && (
            <ChevronRight className="size-2.5 text-muted-foreground/30" />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message, onAdopt }: { message: HermesMessage; onAdopt: (target: AdoptTarget) => void }) {
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

          {/* Adopt button for assistant messages */}
          {!isUser && <AdoptButton message={message} onAdopt={onAdopt} />}
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

function WelcomeScreen({ onQuickAction, project }: { onQuickAction: (prompt: string) => void; project: { title: string; spark: string; synopsis: string | null; goldenFinger: string | null; worldBackground: string | null; characters: unknown[]; worldRules: unknown[]; chapters: unknown[] } }) {
  const hasSpark = !!(project.title && project.title !== '未命名项目' && project.spark)
  const hasArchitecture = hasSpark && !!(project.synopsis && project.goldenFinger && project.worldBackground && project.characters.length > 0)
  const hasOutline = hasArchitecture && project.chapters.length > 0

  let currentStage = 'spark'
  if (hasOutline) currentStage = 'writing'
  else if (hasArchitecture) currentStage = 'outline'
  else if (hasSpark) currentStage = 'architecture'

  const relevantActions = QUICK_ACTIONS.filter(a =>
    a.stage === 'any' || a.stage === currentStage ||
    a.stage === WORKFLOW_STAGES[WORKFLOW_STAGES.findIndex(s => s.key === currentStage) + 1]?.key
  ).slice(0, 6)

  const stageMessages: Record<string, { title: string; desc: string }> = {
    spark: { title: '开始创作之旅', desc: '输入灵感关键词，我将帮你生成完整的小说设定，开启你的网文创作' },
    architecture: { title: '完善世界观架构', desc: '灵感已就绪！让我帮你补充角色、世界规则，构建坚实的创作基础' },
    outline: { title: '推演因果大纲', desc: '架构已完善！现在可以推演前5章的因果大纲，让故事有逻辑地展开' },
    writing: { title: '进入创作空间', desc: '大纲已就绪！让我帮你生成章节草稿，或检查前后一致性' },
  }

  const msg = stageMessages[currentStage] || stageMessages.spark

  return (
    <div className="flex flex-col items-center justify-center h-full px-5 py-6 text-center">
      <div className="relative mb-5">
        <div className="size-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-amber-500/20 to-rose-500/20 border border-border/30 flex items-center justify-center">
          <MessageSquare className="size-8 text-emerald-500/70" />
        </div>
        <div className="absolute -top-1 -right-1 size-3 rounded-full bg-amber-400 animate-pulse" />
      </div>

      <h3 className="text-lg font-bold text-foreground mb-1">{msg.title}</h3>
      <p className="text-xs text-muted-foreground max-w-[240px] mb-3 leading-relaxed">
        {msg.desc}
      </p>

      <div className="mb-5">
        <WorkflowMiniProgress project={project} />
      </div>

      <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
        {relevantActions.map((action) => (
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
    setPendingAdopt,
  } = useAppStore()

  const [input, setInput] = useState('')
  const [skillUpdating, setSkillUpdating] = useState(false)
  const [skillLastUpdated, setSkillLastUpdated] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load skill info on mount
  useEffect(() => {
    async function loadSkillInfo() {
      try {
        const res = await fetch('/api/skills')
        if (res.ok) {
          const data = await res.json()
          if (data.wangwenCreative) {
            setSkillLastUpdated(data.wangwenCreative.lastUpdated)
          }
        }
      } catch {
        // Ignore
      }
    }
    loadSkillInfo()
  }, [])

  // Update skill from GitHub
  const handleUpdateSkill = useCallback(async () => {
    setSkillUpdating(true)
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_wangwen' }),
      })
      const data = await res.json()
      if (data.success) {
        setSkillLastUpdated(data.version || new Date().toISOString())
        addHermesMessage({
          id: `msg-${Date.now()}-system`,
          role: 'assistant',
          content: `✅ 网文创作技能已更新到最新版本！新的创作方法论、类型模板和素材库已就绪。`,
          timestamp: new Date().toISOString(),
        })
      } else {
        addHermesMessage({
          id: `msg-${Date.now()}-system`,
          role: 'assistant',
          content: `❌ 技能更新失败：${data.message}`,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error('Skill update error:', err)
    } finally {
      setSkillUpdating(false)
    }
  }, [addHermesMessage])

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

  // ─── Process Hermes response ───

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

      // Handle navigation and chapter selection
      if (data.actions) {
        for (const action of data.actions) {
          if (action.navigateTo) {
            setActiveTab(action.navigateTo as AppTab)
          }
          if (action.type === 'write_chapter_draft' && action.status === 'success' && action.detail) {
            const match = action.detail.match(/第(\d+)章/)
            if (match) {
              const order = parseInt(match[1])
              const project = useAppStore.getState().currentProject
              if (project) {
                const chapter = project.chapters.find(c => c.order === order)
                if (chapter) {
                  setActiveChapterId(chapter.id)
                }
              }
            }
            refreshProject()
          }
        }
      }
    },
    [addHermesMessage, setCurrentProject, setActiveTab, setActiveChapterId, refreshProject]
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
          content: `抱歉，遇到了问题：${err instanceof Error ? err.message : '请稍后再试'}`,
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

  // ─── Adopt from Hermes ────────────────────────────────────────────────────

  const handleAdopt = useCallback((target: AdoptTarget) => {
    setPendingAdopt(target)

    // Navigate to the appropriate tab if needed
    if (target.type === 'project_field') {
      // If we're not on architecture tab, navigate there
      const activeTab = useAppStore.getState().activeTab
      if (activeTab !== 'architecture') {
        setActiveTab('architecture')
      }
    } else if (target.type === 'character' || target.type === 'world_rule') {
      const activeTab = useAppStore.getState().activeTab
      if (activeTab !== 'architecture') {
        setActiveTab('architecture')
      }
    } else if (target.type === 'chapter_content') {
      const activeTab = useAppStore.getState().activeTab
      if (activeTab !== 'writing') {
        setActiveTab('writing')
      }
    } else if (target.type === 'spark') {
      setActiveTab('spark')
    }
  }, [setPendingAdopt, setActiveTab])

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

  // Context-aware quick actions
  const getContextActions = () => {
    const hasSpark = !!(currentProject.title && currentProject.title !== '未命名项目' && currentProject.spark)
    const hasArchitecture = hasSpark && !!(currentProject.synopsis && currentProject.goldenFinger && currentProject.worldBackground && currentProject.characters.length > 0)
    const hasOutline = hasArchitecture && currentProject.chapters.length > 0

    let stage = 'spark'
    if (hasOutline) stage = 'writing'
    else if (hasArchitecture) stage = 'outline'
    else if (hasSpark) stage = 'architecture'

    return QUICK_ACTIONS.filter(a =>
      a.stage === 'any' || a.stage === stage
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center shadow-sm">
              <MessageSquare className="size-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Hermes</h3>
              <p className="text-[10px] text-muted-foreground">创作引导 · 采纳建议填充左侧</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Skill Update Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                  onClick={handleUpdateSkill}
                  disabled={skillUpdating}
                >
                  <RefreshCw className={cn("size-3.5", skillUpdating && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>更新网文创作技能</TooltipContent>
            </Tooltip>

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

        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/5 border border-emerald-500/10 flex-1 min-w-0">
            <BookOpen className="size-3 text-emerald-500 shrink-0" />
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
              {currentProject.title}
            </span>
          </div>
          {/* Skill Badge */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/5 border border-amber-500/10 shrink-0">
            <BookMarked className="size-3 text-amber-500" />
            <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
              网文创技
            </span>
          </div>
        </div>
        <div className="mt-1.5">
          <WorkflowMiniProgress project={currentProject} />
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-4">
        {!hasMessages ? (
          <WelcomeScreen onQuickAction={handleQuickAction} project={currentProject} />
        ) : (
          <>
            {hermesMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onAdopt={handleAdopt} />
            ))}

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

      {/* Quick Actions (when messages exist) */}
      {hasMessages && !hermesLoading && (
        <div className="shrink-0 px-4 py-1.5 border-t border-border/30">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {getContextActions().map((action) => (
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

      {/* Input Area */}
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
