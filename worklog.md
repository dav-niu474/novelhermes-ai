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

---
Task ID: 3
Agent: Main
Task: 将 Hermes Agent 与系统创作脚手链深度集成，实现全程引导与工具执行

Work Log:
- 重构 Hermes 类型系统 (types.ts)
  - 新增 HermesActionType: generate_spark, generate_outline, add_character, add_world_rule, write_chapter_draft, navigate_to, analyze_project_state
  - 新增 HermesAction 接口 (type, label, status, detail)
  - HermesMessage 新增 actions 字段
- 重写 Hermes 后端 API (route.ts) — 工具执行循环架构
  - 定义7个可执行工具及其描述（供AI识别和调用）
  - 实现工具解析器：从AI响应中提取 ```action JSON 块
  - 实现工具执行器：每个工具对应真实的数据库操作
    - generate_spark: 调用AI生成灵感 → 保存到DB
    - generate_outline: 调用AI推演大纲 → 保存章节+节拍到DB
    - add_character: 创建角色到DB
    - add_world_rule: 创建世界规则到DB
    - write_chapter_draft: AI生成章节正文 → 保存到DB
    - navigate_to: 返回导航指令
    - analyze_project_state: 分析项目缺失项和进度
  - 系统提示词增加工具说明、调用格式规范、项目状态分析
  - AI响应后自动解析工具调用、执行、返回结果+更新项目
- 扩展 Zustand Store
  - 新增 refreshProject() 方法（从后端刷新当前项目）
  - setCurrentProject 同时更新 projects 列表
- 重写 HermesAgent 前端组件
  - 新增 ActionBadge 组件：显示工具执行状态（成功/运行中/失败）
  - 新增6个快捷操作（一键创作、灵感瓶颈、一致性检查、项目诊断、写章草稿、推演大纲）
  - processResponse 处理逻辑：更新项目状态、执行导航、刷新数据
  - 消息气泡显示 actions 执行徽章
- 主页面无需改动，通过 store 自动同步

Stage Summary:
- ✅ Hermes Agent 可直接执行7种创作工具
- ✅ AI自动识别用户意图并调用工具（如"帮我生成灵感"→调用generate_spark）
- ✅ 工具执行结果自动同步到前端项目状态
- ✅ 支持导航操作（如生成大纲后自动跳转到大纲页）
- ✅ 支持一键创作流程（灵感到大纲）
- ✅ API 实测成功：spark+outline 链式执行耗时15-35秒
- ✅ Lint 通过（0 errors）
