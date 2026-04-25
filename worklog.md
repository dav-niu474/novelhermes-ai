---
Task ID: 1
Agent: Main
Task: NovelCraft Architect Pro 系统完整开发

Work Log:
- 设计并创建 Prisma 数据库 Schema (NovelProject, Character, WorldRule, Chapter, StoryBeat)
- 运行 db:push 创建数据库表
- 创建核心类型定义 (src/lib/types.ts) 和 Zustand Store (src/lib/store.ts)
- 创建 AI 辅助函数 (src/lib/ai.ts) - 灵感激发、大纲推演、节拍生成
- 创建所有 API 路由:
  - /api/projects (GET, POST)
  - /api/projects/[id] (GET, PUT, DELETE)
  - /api/projects/[id]/characters (POST)
  - /api/characters/[id] (PUT, DELETE)
  - /api/projects/[id]/world-rules (POST)
  - /api/world-rules/[id] (PUT, DELETE)
  - /api/projects/[id]/chapters (POST)
  - /api/chapters/[id] (PUT, DELETE)
  - /api/ai/spark (POST)
  - /api/ai/outline (POST)
  - /api/ai/beats (POST)
- 构建4个核心前端组件:
  - SparkLab.tsx - 灵感激发实验室
  - ArchitectureBoard.tsx - 架构看板
  - OutlineEngine.tsx - 因果律大纲推演
  - WritingSpace.tsx - 沉浸式创作空间
- 构建主页面 (page.tsx) 整合所有组件、导航栏、项目选择器
- 更新 layout.tsx 支持 ThemeProvider 和 TooltipProvider
- 修复 React Hooks 规则错误 (useEffect 在条件返回之后)
- 修复 ESLint warnings (依赖数组、unused directives)
- 增强 AI JSON 解析鲁棒性 (extractJSON 函数)
- 修复 SparkLab 保存逻辑 (避免重复调用 AI)
- 修复 OutlineEngine 刷新逻辑 (beats 重新生成后正确刷新项目)
- 增强 outline API 的容错性 (缺失字段提供默认值)

Stage Summary:
- ✅ 数据库 Schema 已完成
- ✅ 所有 API 路由已完成
- ✅ 4个核心前端组件已完成
- ✅ 主布局和导航已完成
- ✅ 深色/浅色主题切换已完成
- ✅ Lint 完全通过 (0 errors, 0 warnings)
- ✅ 开发服务器正常运行

---
Task ID: 2
Agent: Main
Task: 集成 Hermes Agent 能力

Work Log:
- 创建 Hermes Agent 后端 API 路由 (/api/ai/hermes/route.ts)
  - 基于 z-ai-web-dev-sdk 的 LLM 对话接口
  - 构建完整项目上下文的系统提示词（书名、简介、金手指、世界观、角色、世界规则、章节概览）
  - 支持多轮对话历史（限制最近20条消息避免上下文溢出）
  - Hermes 角色设定：希腊信使之神，创作顾问+灵感激发+一致性守护
- 扩展类型定义 (src/lib/types.ts)
  - 新增 HermesMessage 接口 (id, role, content, timestamp)
  - 新增 HermesConversation 接口
- 扩展 Zustand Store (src/lib/store.ts)
  - 新增 hermesOpen/setHermesOpen/toggleHermesOpen 状态
  - 新增 hermesMessages/addHermesMessage/clearHermesMessages 对话消息管理
  - 新增 hermesLoading/setHermesLoading 加载状态
- 构建 HermesAgent 前端组件 (src/components/novelcraft/HermesAgent.tsx)
  - 聊天面板 UI（消息气泡、用户/助手头像、时间戳）
  - 快捷操作按钮（灵感瓶颈/一致性检查/情节发展/角色深化）
  - 欢迎屏幕（无消息时显示）
  - 加载动画（思考中+弹跳点）
  - Markdown 格式化（加粗文本渲染）
  - Enter 发送/Shift+Enter 换行
  - 无项目时的空状态提示
- 集成到主页面 (src/app/page.tsx)
  - 桌面端：右侧可展开/收起的侧边面板（380px宽）
  - 移动端：全屏覆盖面板 + 关闭按钮
  - 导航栏 Hermes 切换按钮（桌面+移动）
  - 右下角浮动按钮（面板关闭时显示，带脉冲动画）
  - 专注模式下自动隐藏 Hermes 面板和浮动按钮
  - 平滑过渡动画

Stage Summary:
- ✅ Hermes Agent 后端 API 已完成并通过测试（AI能识别项目上下文并回应）
- ✅ 类型定义和状态管理已扩展
- ✅ 聊天组件 UI 已完成
- ✅ 主页面集成已完成（侧边面板+浮动按钮）
- ✅ Lint 通过（0 errors）
- ✅ 开发服务器正常运行
- ✅ API 实测成功：Hermes 能正确引用项目设定进行对话
