'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import type { Character, WorldRule } from '@/lib/types'
import type { AdoptTarget } from '@/lib/store'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  BookOpen,
  Users,
  Shield,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Globe,
  Sparkles,
  Tags,
  FileText,
  GitBranch,
  ArrowRight,
  Loader2,
  Wand2,
  Check,
  Star,
  Flame,
  Zap,
} from 'lucide-react'

// ===== Role Badge Colors =====
const ROLE_STYLES: Record<string, string> = {
  主角: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
  反派: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
  配角: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
}

const ROLE_DEFAULT = 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:border-gray-800'

// ===== World Rule Category Colors =====
const CATEGORY_COLORS: Record<string, string> = {
  基础规则: 'border-l-purple-500',
  力量体系: 'border-l-emerald-500',
  社会结构: 'border-l-amber-500',
  地理环境: 'border-l-rose-500',
  历史设定: 'border-l-cyan-500',
}

const CATEGORY_DEFAULT = 'border-l-gray-400'

const CATEGORY_OPTIONS = ['基础规则', '力量体系', '社会结构', '地理环境', '历史设定']

// ===== AI Character Suggestion Card Colors =====
const ROLE_CARD_STYLES: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  主角: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', icon: <Star className="size-3.5" /> },
  反派: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-600 dark:text-rose-400', icon: <Flame className="size-3.5" /> },
  配角: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-600 dark:text-purple-400', icon: <Zap className="size-3.5" /> },
}

// ===== Refresh project helper =====
async function refreshProject(projectId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}`)
  if (res.ok) {
    const data = await res.json()
    const store = useAppStore.getState()
    store.setCurrentProject(data)
    const { projects } = store
    store.setProjects(projects.map(p => (p.id === data.id ? data : p)))
  }
}

// ====================================================================
// Character Dialog (Add / Edit) with AI Generation
// ====================================================================
interface CharacterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  character: Character | null
  projectId: string
}

interface AICharacterOption {
  name: string
  role: string
  personality: string
  background: string
  conflict: string
}

function CharacterDialog({ open, onOpenChange, character, projectId }: CharacterDialogProps) {
  const isEdit = !!character
  const [name, setName] = useState('')
  const [role, setRole] = useState('主角')
  const [personality, setPersonality] = useState('')
  const [background, setBackground] = useState('')
  const [conflict, setConflict] = useState('')
  const [saving, setSaving] = useState(false)

  // AI generation state
  const [aiOptions, setAiOptions] = useState<AICharacterOption[] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedAiIndex, setSelectedAiIndex] = useState<number | null>(null)

  // Sync state when dialog opens or character changes
  useEffect(() => {
    if (open) {
      if (character) {
        setName(character.name)
        setRole(character.role)
        setPersonality(character.personality ?? '')
        setBackground(character.background ?? '')
        setConflict(character.conflict ?? '')
      } else {
        setName('')
        setRole('主角')
        setPersonality('')
        setBackground('')
        setConflict('')
      }
      setAiOptions(null)
      setSelectedAiIndex(null)
    }
  }, [open, character])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('角色名称不能为空')
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        const res = await fetch(`/api/characters/${character!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, role, personality, background, conflict }),
        })
        if (!res.ok) throw new Error()
        toast.success('角色已更新')
      } else {
        const res = await fetch(`/api/projects/${projectId}/characters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, role, personality, background, conflict }),
        })
        if (!res.ok) throw new Error()
        toast.success('角色已创建')
      }
      await refreshProject(projectId)
      onOpenChange(false)
    } catch {
      toast.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // AI character generation
  const handleAIGenerate = async (targetRole?: string) => {
    setAiLoading(true)
    setAiOptions(null)
    setSelectedAiIndex(null)
    try {
      const res = await fetch('/api/ai/character-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, roleType: targetRole || '任意' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'AI生成失败')
        return
      }
      if (data.characters && Array.isArray(data.characters)) {
        setAiOptions(data.characters)
      } else {
        toast.error('AI返回格式异常，请重试')
      }
    } catch {
      toast.error('AI角色生成失败，请重试')
    } finally {
      setAiLoading(false)
    }
  }

  // Select an AI option to auto-fill
  const handleSelectAIOption = (index: number) => {
    const option = aiOptions![index]
    setName(option.name || '')
    setRole(option.role || '主角')
    setPersonality(option.personality || '')
    setBackground(option.background || '')
    setConflict(option.conflict || '')
    setSelectedAiIndex(index)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑角色' : '添加角色'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改角色的详细信息' : '为项目添加新角色，也可以让AI生成方案'}
          </DialogDescription>
        </DialogHeader>

        {/* AI Generation Section */}
        {!isEdit && (
          <div className="border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wand2 className="size-4 text-emerald-500" />
                <span className="text-sm font-medium">AI 生成角色方案</span>
              </div>
              <div className="flex gap-1.5">
                {['主角', '反派', '配角', '任意'].map((targetRole) => (
                  <Button
                    key={targetRole}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => handleAIGenerate(targetRole === '任意' ? undefined : targetRole)}
                    disabled={aiLoading}
                  >
                    {aiLoading ? <Loader2 className="size-3 animate-spin" /> : null}
                    {targetRole}
                  </Button>
                ))}
              </div>
            </div>

            {/* AI Options Display */}
            {aiOptions && aiOptions.length > 0 && (
              <div className="grid gap-2 mt-2">
                <p className="text-xs text-muted-foreground">选择一个方案一键填写，或自由修改：</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {aiOptions.map((opt, i) => {
                    const roleStyle = ROLE_CARD_STYLES[opt.role] || ROLE_CARD_STYLES['配角']
                    return (
                      <button
                        key={i}
                        onClick={() => handleSelectAIOption(i)}
                        className={`text-left rounded-lg border p-3 transition-all ${
                          selectedAiIndex === i
                            ? `ring-2 ring-emerald-500 ${roleStyle.bg} ${roleStyle.border}`
                            : 'border-border/50 hover:border-border hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={roleStyle.text}>{roleStyle.icon}</span>
                          <span className="font-medium text-sm">{opt.name}</span>
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ml-auto ${roleStyle.text} ${roleStyle.border}`}>
                            {opt.role}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{opt.personality}</p>
                        {opt.conflict && (
                          <p className="text-[10px] text-rose-500/70 line-clamp-1 mt-1">⚔ {opt.conflict}</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Fields */}
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="char-name">角色名称 *</Label>
            <Input
              id="char-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入角色名称"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="char-role">角色类型</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="主角">主角</SelectItem>
                <SelectItem value="反派">反派</SelectItem>
                <SelectItem value="配角">配角</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="char-personality">性格特质</Label>
            <Textarea
              id="char-personality"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="描述角色的性格特点"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="char-background">背景档案</Label>
            <Textarea
              id="char-background"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="描述角色的背景故事"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="char-conflict">冲突描述</Label>
            <Textarea
              id="char-conflict"
              value={conflict}
              onChange={(e) => setConflict(e.target.value)}
              placeholder="描述角色面临的冲突"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="size-4" />
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ====================================================================
// World Rule Dialog (Add / Edit)
// ====================================================================
interface WorldRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: WorldRule | null
  projectId: string
}

function WorldRuleDialog({ open, onOpenChange, rule, projectId }: WorldRuleDialogProps) {
  const isEdit = !!rule
  const [category, setCategory] = useState('基础规则')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (rule) {
        setCategory(rule.category)
        setTitle(rule.title)
        setContent(rule.content)
      } else {
        setCategory('基础规则')
        setTitle('')
        setContent('')
      }
    }
  }, [open, rule])

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('规则标题不能为空')
      return
    }
    if (!content.trim()) {
      toast.error('规则内容不能为空')
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        const res = await fetch(`/api/world-rules/${rule!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, title, content }),
        })
        if (!res.ok) throw new Error()
        toast.success('世界规则已更新')
      } else {
        const res = await fetch(`/api/projects/${projectId}/world-rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, title, content }),
        })
        if (!res.ok) throw new Error()
        toast.success('世界规则已创建')
      }
      await refreshProject(projectId)
      onOpenChange(false)
    } catch {
      toast.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑世界规则' : '添加世界规则'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改世界规则的详细内容' : '为项目添加新的世界规则锚点'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="rule-category">规则分类</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rule-title">规则标题 *</Label>
            <Input
              id="rule-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入规则标题"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rule-content">规则内容 *</Label>
            <Textarea
              id="rule-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="详细描述这条世界规则"
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="size-4" />
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ====================================================================
// Inline Editable Field
// ====================================================================
interface InlineEditFieldProps {
  label: string
  value: string
  icon: React.ReactNode
  placeholder?: string
  multiline?: boolean
  projectId: string
  field: string
  adoptValue?: string  // Value from Hermes adopt
  onAdoptConsumed?: () => void
}

function InlineEditField({
  label,
  value,
  icon,
  placeholder = '点击编辑...',
  multiline = false,
  projectId,
  field,
  adoptValue,
  onAdoptConsumed,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  // Handle adopt from Hermes
  useEffect(() => {
    if (adoptValue && adoptValue !== value) {
      setDraft(adoptValue)
      setEditing(true)
    }
  }, [adoptValue, value])

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(value)
    setEditing(false)
    onAdoptConsumed?.()
  }

  const saveEdit = async () => {
    if (draft === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: draft }),
      })
      if (!res.ok) throw new Error()
      await refreshProject(projectId)
      toast.success(`${label}已更新`)
      setEditing(false)
      onAdoptConsumed?.()
    } catch {
      toast.error('更新失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="group">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          {multiline ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              rows={4}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelEdit()
              }}
            />
          ) : (
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
            />
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
              <X className="size-3.5" />
              取消
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={saving}>
              <Save className="size-3.5" />
              {saving ? '保存中' : '保存'}
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={startEdit}
          className="min-h-[36px] rounded-md border border-transparent px-3 py-2 text-sm cursor-pointer transition-colors hover:border-border hover:bg-muted/50"
        >
          {value ? (
            <span className="whitespace-pre-wrap">{value}</span>
          ) : (
            <span className="text-muted-foreground italic">{placeholder}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ====================================================================
// Tags Editor (comma-separated)
// ====================================================================
interface TagsEditorProps {
  value: string
  projectId: string
}

function TagsEditor({ value, projectId }: TagsEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  const tags = value
    ? value.split(',').map((t) => t.trim()).filter(Boolean)
    : []

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(value)
    setEditing(false)
  }

  const saveEdit = async () => {
    if (draft === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: draft }),
      })
      if (!res.ok) throw new Error()
      await refreshProject(projectId)
      toast.success('标签已更新')
      setEditing(false)
    } catch {
      toast.error('更新失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <Tags className="size-4 text-muted-foreground" />
        <Label className="text-sm font-medium text-muted-foreground">作品标签</Label>
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="用逗号分隔标签，如：玄幻,热血,升级"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit()
              if (e.key === 'Escape') cancelEdit()
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
              <X className="size-3.5" />
              取消
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={saving}>
              <Save className="size-3.5" />
              {saving ? '保存中' : '保存'}
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={startEdit}
          className="min-h-[36px] rounded-md border border-transparent px-3 py-2 cursor-pointer transition-colors hover:border-border hover:bg-muted/50"
        >
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground italic text-sm">点击添加标签...</span>
          )}
        </div>
      )}
    </div>
  )
}

// ====================================================================
// Main: ArchitectureBoard
// ====================================================================
export default function ArchitectureBoard() {
  const { currentProject, setActiveTab, pendingAdopt, consumeAdopt } = useAppStore()

  // Character dialog state
  const [charDialogOpen, setCharDialogOpen] = useState(false)
  const [editingChar, setEditingChar] = useState<Character | null>(null)

  // World rule dialog state
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<WorldRule | null>(null)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'character' | 'worldRule'; id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Adopt state from Hermes
  const [adoptedField, setAdoptedField] = useState<string | null>(null)
  const [adoptedValue, setAdoptedValue] = useState<string | undefined>(undefined)

  // Handle adopt from Hermes
  useEffect(() => {
    if (!pendingAdopt) return
    if (pendingAdopt.type === 'project_field') {
      const target = pendingAdopt as Extract<AdoptTarget, { type: 'project_field' }>
      setAdoptedField(target.field)
      setAdoptedValue(target.value)
      consumeAdopt()
      toast.success('已采纳Hermes的建议，请确认后保存')
    } else if (pendingAdopt.type === 'character') {
      const target = pendingAdopt as Extract<AdoptTarget, { type: 'character' }>
      // Open character dialog with pre-filled data
      setEditingChar(null)
      setCharDialogOpen(true)
      consumeAdopt()
      // We'll handle this differently - create the character directly
      handleCreateCharacterFromAdopt(target.character)
    } else if (pendingAdopt.type === 'world_rule') {
      const target = pendingAdopt as Extract<AdoptTarget, { type: 'world_rule' }>
      consumeAdopt()
      handleCreateWorldRuleFromAdopt(target.rule)
    }
  }, [pendingAdopt, consumeAdopt])

  const handleCreateCharacterFromAdopt = async (charData: { name: string; role: string; personality: string; background: string; conflict: string }) => {
    if (!currentProject) return
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(charData),
      })
      if (!res.ok) throw new Error()
      await refreshProject(currentProject.id)
      toast.success(`角色「${charData.name}」已采纳并创建`)
    } catch {
      toast.error('采纳角色失败，请重试')
    }
  }

  const handleCreateWorldRuleFromAdopt = async (ruleData: { category: string; title: string; content: string }) => {
    if (!currentProject) return
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/world-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData),
      })
      if (!res.ok) throw new Error()
      await refreshProject(currentProject.id)
      toast.success(`世界规则「${ruleData.title}」已采纳并创建`)
    } catch {
      toast.error('采纳世界规则失败，请重试')
    }
  }

  // ---- Character actions ----
  const openAddCharacter = () => {
    setEditingChar(null)
    setCharDialogOpen(true)
  }

  const openEditCharacter = (char: Character) => {
    setEditingChar(char)
    setCharDialogOpen(true)
  }

  const handleDeleteCharacter = async (id: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/characters/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await refreshProject(currentProject!.id)
      toast.success('角色已删除')
      setDeleteTarget(null)
    } catch {
      toast.error('删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  // ---- World rule actions ----
  const openAddRule = () => {
    setEditingRule(null)
    setRuleDialogOpen(true)
  }

  const openEditRule = (rule: WorldRule) => {
    setEditingRule(rule)
    setRuleDialogOpen(true)
  }

  const handleDeleteRule = async (id: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/world-rules/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await refreshProject(currentProject!.id)
      toast.success('世界规则已删除')
      setDeleteTarget(null)
    } catch {
      toast.error('删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  // ---- No project selected ----
  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="rounded-full bg-muted p-6">
          <BookOpen className="size-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">尚未选择项目</h2>
        <p className="text-muted-foreground max-w-sm">
          请先前往灵感实验室创建或选择一个项目，再使用架构看板
        </p>
        <Button onClick={() => setActiveTab('spark')} variant="outline">
          前往灵感实验室
        </Button>
      </div>
    )
  }

  const project = currentProject
  const characters = project.characters ?? []
  const worldRules = project.worldRules ?? []

  // Calculate workflow completion
  const hasTitle = !!(project.title && project.title !== '未命名项目')
  const hasSynopsis = !!project.synopsis
  const hasGoldenFinger = !!project.goldenFinger
  const hasWorldBackground = !!project.worldBackground
  const hasCharacters = characters.length > 0
  const hasWorldRules = worldRules.length > 0
  const workflowSteps = [
    { label: '书名', done: hasTitle },
    { label: '简介', done: hasSynopsis },
    { label: '金手指', done: hasGoldenFinger },
    { label: '世界观', done: hasWorldBackground },
    { label: '角色', done: hasCharacters },
    { label: '世界规则', done: hasWorldRules },
  ]
  const completedSteps = workflowSteps.filter((s) => s.done).length
  const totalSteps = workflowSteps.length
  const progressPercent = Math.round((completedSteps / totalSteps) * 100)
  const isArchitectureReady = completedSteps >= 4

  // Group world rules by category
  const rulesByCategory = worldRules.reduce<Record<string, WorldRule[]>>((acc, rule) => {
    const cat = rule.category || '基础规则'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(rule)
    return acc
  }, {})

  const sortedCategories = Object.keys(rulesByCategory).sort((a, b) => {
    const ai = CATEGORY_OPTIONS.indexOf(a)
    const bi = CATEGORY_OPTIONS.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b)
  })

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/40">
          <Shield className="size-5 text-emerald-700 dark:text-emerald-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">架构看板</h1>
          <p className="text-sm text-muted-foreground">
            编辑项目百科全书、角色档案和世界规则锚点
          </p>
        </div>
      </div>

      {/* Workflow Progress Banner */}
      <Card className="mb-6 border-border/50">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">架构完善度</span>
                <span className="text-sm text-muted-foreground">{completedSteps}/{totalSteps}</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{progressPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {workflowSteps.map((step) => (
                  <span
                    key={step.label}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                      step.done
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step.done ? '✓' : '○'} {step.label}
                  </span>
                ))}
              </div>
            </div>
            <Button
              onClick={() => setActiveTab('outline')}
              disabled={!isArchitectureReady}
              className={`gap-2 shrink-0 ${
                isArchitectureReady
                  ? 'bg-gradient-to-r from-emerald-600 to-purple-600 hover:from-emerald-700 hover:to-purple-700 text-white shadow-md'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <GitBranch className="size-4" />
              前往大纲推演
              <ArrowRight className="size-4" />
            </Button>
          </div>
          {!isArchitectureReady && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              💡 建议至少完善 4 项设定（书名、简介、金手指、世界观）后再推演大纲
            </p>
          )}
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Project Settings Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="size-5 text-purple-600 dark:text-purple-400" />
                <CardTitle>项目百科全书</CardTitle>
              </div>
              <CardDescription>点击任意字段即可编辑，修改后即时保存</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <InlineEditField
                label="书名"
                value={project.title}
                icon={<FileText className="size-4" />}
                placeholder="输入书名..."
                projectId={project.id}
                field="title"
                adoptValue={adoptedField === 'title' ? adoptedValue : undefined}
                onAdoptConsumed={() => { setAdoptedField(null); setAdoptedValue(undefined) }}
              />
              <Separator />
              <InlineEditField
                label="一句话简介"
                value={project.synopsis ?? ''}
                icon={<Sparkles className="size-4" />}
                placeholder="用一句话概括你的故事..."
                multiline
                projectId={project.id}
                field="synopsis"
                adoptValue={adoptedField === 'synopsis' ? adoptedValue : undefined}
                onAdoptConsumed={() => { setAdoptedField(null); setAdoptedValue(undefined) }}
              />
              <Separator />
              <InlineEditField
                label="核心金手指"
                value={project.goldenFinger ?? ''}
                icon={<Sparkles className="size-4" />}
                placeholder="描述主角的核心能力或金手指..."
                multiline
                projectId={project.id}
                field="goldenFinger"
                adoptValue={adoptedField === 'goldenFinger' ? adoptedValue : undefined}
                onAdoptConsumed={() => { setAdoptedField(null); setAdoptedValue(undefined) }}
              />
              <Separator />
              <InlineEditField
                label="世界观背景"
                value={project.worldBackground ?? ''}
                icon={<Globe className="size-4" />}
                placeholder="描述世界观设定..."
                multiline
                projectId={project.id}
                field="worldBackground"
                adoptValue={adoptedField === 'worldBackground' ? adoptedValue : undefined}
                onAdoptConsumed={() => { setAdoptedField(null); setAdoptedValue(undefined) }}
              />
              <Separator />
              <TagsEditor value={project.tags ?? ''} projectId={project.id} />
            </CardContent>
          </Card>

          {/* Characters Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-5 text-amber-600 dark:text-amber-400" />
                  <CardTitle>角色档案</CardTitle>
                  <Badge variant="secondary" className="ml-1">
                    {characters.length}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={openAddCharacter} className="gap-1">
                    <Plus className="size-4" />
                    添加角色
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {characters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Users className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">尚未添加角色</p>
                  <p className="text-muted-foreground text-xs">
                    点击上方按钮手动添加，或让AI生成角色方案
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 mt-1"
                    onClick={openAddCharacter}
                  >
                    <Wand2 className="size-3.5 text-emerald-500" />
                    AI生成角色
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                  {characters.map((char) => (
                    <div
                      key={char.id}
                      className="rounded-lg border p-4 transition-colors hover:bg-muted/30 group"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{char.name}</span>
                          <Badge className={ROLE_STYLES[char.role] ?? ROLE_DEFAULT}>
                            {char.role}
                          </Badge>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openEditCharacter(char)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'character',
                                id: char.id,
                                name: char.name,
                              })
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm">
                        {char.personality && (
                          <div>
                            <span className="text-muted-foreground font-medium">性格：</span>
                            <span>{char.personality}</span>
                          </div>
                        )}
                        {char.background && (
                          <div>
                            <span className="text-muted-foreground font-medium">背景：</span>
                            <span>{char.background}</span>
                          </div>
                        )}
                        {char.conflict && (
                          <div>
                            <span className="text-muted-foreground font-medium">冲突：</span>
                            <span className="text-rose-700 dark:text-rose-400">
                              {char.conflict}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: World Rules */}
        <div className="lg:col-span-2">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="size-5 text-rose-600 dark:text-rose-400" />
                  <CardTitle>世界规则锚点</CardTitle>
                  <Badge variant="secondary" className="ml-1">
                    {worldRules.length}
                  </Badge>
                </div>
                <Button size="sm" onClick={openAddRule}>
                  <Plus className="size-4" />
                  添加规则
                </Button>
              </div>
              <CardDescription>
                这些规则在写作时将作为锚点持续生效，确保故事一致性
              </CardDescription>
            </CardHeader>
            <CardContent>
              {worldRules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Shield className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">尚未添加世界规则</p>
                  <p className="text-muted-foreground text-xs">
                    定义力量体系、社会结构等规则，确保写作时世界观一致
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 max-h-[700px] overflow-y-auto pr-1 custom-scrollbar">
                  {sortedCategories.map((category) => (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className={`size-2 rounded-full ${
                            category === '力量体系'
                              ? 'bg-emerald-500'
                              : category === '社会结构'
                              ? 'bg-amber-500'
                              : category === '地理环境'
                              ? 'bg-rose-500'
                              : category === '历史设定'
                              ? 'bg-cyan-500'
                              : 'bg-purple-500'
                          }`}
                        />
                        <span className="text-sm font-semibold">{category}</span>
                        <Badge variant="outline" className="text-xs">
                          {rulesByCategory[category].length}
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-2 ml-3">
                        {rulesByCategory[category].map((rule) => (
                          <div
                            key={rule.id}
                            className={`rounded-md border-l-4 ${
                              CATEGORY_COLORS[category] ?? CATEGORY_DEFAULT
                            } border border-l-4 bg-card p-3 group transition-colors hover:bg-muted/30`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="font-medium text-sm">{rule.title}</span>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => openEditRule(rule)}
                                >
                                  <Pencil className="size-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-destructive hover:text-destructive"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'worldRule',
                                      id: rule.id,
                                      name: rule.title,
                                    })
                                  }
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                              {rule.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <CharacterDialog
        open={charDialogOpen}
        onOpenChange={setCharDialogOpen}
        character={editingChar}
        projectId={project.id}
      />

      <WorldRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        rule={editingRule}
        projectId={project.id}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'character' ? (
                <>
                  确定要删除角色 <strong>&quot;{deleteTarget?.name}&quot;</strong> 吗？此操作不可撤销。
                </>
              ) : (
                <>
                  确定要删除世界规则 <strong>&quot;{deleteTarget?.name}&quot;</strong> 吗？此操作不可撤销。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => {
                if (!deleteTarget) return
                if (deleteTarget.type === 'character') {
                  handleDeleteCharacter(deleteTarget.id)
                } else {
                  handleDeleteRule(deleteTarget.id)
                }
              }}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
