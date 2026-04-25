# NovelCraft Architect Pro - Work Log

---
Task ID: 1
Agent: Main
Task: Redesign Prisma schema for hierarchical outline

Work Log:
- Added Volume, Stage, Unit, PlotLine, PlotPoint models to prisma/schema.prisma
- Chapter now belongs to Unit (unitId) instead of directly to NovelProject
- Chapter also has projectId for easy queries
- PlotLine has type (main/side) and color
- PlotPoint has targetLevel and targetId for linking to hierarchy nodes
- StoryBeat kept as-is under Chapter
- Pushed schema to Supabase PostgreSQL

Stage Summary:
- New schema: NovelProject → Volume → Stage → Unit → Chapter
- NovelProject → PlotLine → PlotPoint
- Database tables created successfully

---
Task ID: 2
Agent: Main
Task: Update TypeScript types and Zustand store

Work Log:
- Updated /src/lib/types.ts with Volume, Stage, Unit, PlotLine, PlotPoint interfaces
- Updated Chapter interface to include unitId, plotPoints
- Added PLOT_LINE_COLORS and PLOT_LINE_TYPE_LABELS constants
- Updated /src/lib/store.ts with new fields: activeUnitId, writingStep, outlineSelection
- Added WritingStep type: 'select_unit' | 'plan_chapters' | 'plot_points' | 'write'
- Added OutlineSelection interface

Stage Summary:
- Types fully updated for hierarchical structure
- Store supports unit-based writing workflow

---
Task ID: 3
Agent: Sub-agent (full-stack-developer)
Task: Create all new API routes for hierarchical outline

Work Log:
- Updated /api/projects/route.ts with full nested include
- Updated /api/projects/[id]/route.ts with nested volumes/plotLines
- Updated /api/chapters/[id]/route.ts to include plotPoints
- Created 12 new route files for volumes, stages, units, plot-lines, plot-points

Stage Summary:
- All CRUD APIs created for hierarchical outline
- Auto-order assignment, cascade deletes, projectId resolution all working

---
Task ID: 4
Agent: Sub-agent (full-stack-developer)
Task: Update AI outline generation for hierarchical structure

Work Log:
- Replaced generateOutline with generateHierarchicalOutline in /src/lib/ai.ts
- Added generateUnitChapterPlan function
- Updated /api/ai/outline/route.ts to create full hierarchy
- Created /api/ai/unit-plan/route.ts for per-unit chapter generation
- Updated /api/ai/writing-assist/route.ts to include plotPoints

Stage Summary:
- AI now generates 卷→阶段→单元→章 hierarchy with plot lines
- Unit-level AI planning available

---
Task ID: 5
Agent: Sub-agent (full-stack-developer)
Task: Rebuild OutlineEngine UI

Work Log:
- Complete rebuild of OutlineEngine component (1954 lines)
- Two-panel layout: left=outline tree, right=plot lines/library
- Hierarchical collapsible tree with inline editing
- Plot line management with color coding
- Plot library with filtering
- AI generation button, add/delete at each level
- Mobile responsive with Sheet drawer

Stage Summary:
- Full hierarchical outline UI working
- Plot lines and plot library integrated

---
Task ID: 6
Agent: Sub-agent (full-stack-developer)
Task: Rebuild WritingSpace UI

Work Log:
- Complete rebuild of WritingSpace component (2036 lines)
- 4-step workflow: select_unit → plan_chapters → plot_points → write
- UnitSelector, ChapterPlanner, PlotPointEditor, WritingEditor sub-components
- AI writing assist integrated in write step
- Auto-save, focus mode, Hermes adopt support
- Step indicator with visual states

Stage Summary:
- Unit-based writing workflow implemented
- AI assist, auto-save, plot points all working

---
Task ID: 7
Agent: Sub-agent (full-stack-developer)
Task: Fix API routes for new schema

Work Log:
- Fixed /api/ai/hermes/route.ts - replaced all project.chapters with flattenChapters helper
- Fixed /api/ai/spark/route.ts - updated include to use nested hierarchy
- Added PROJECT_INCLUDE constant for consistent queries
- Updated all Prisma queries to use volumes→stages→units→chapters include

Stage Summary:
- All API routes now work with new hierarchical schema
- No more references to direct chapters relation on NovelProject

---
Task ID: 8
Agent: Main Agent
Task: Fix inspiration generation crash on Vercel deployment

Work Log:
- Diagnosed root cause: system env var DATABASE_URL=file:... (old SQLite) overrides .env.local
- Fixed db.ts: Override DATABASE_URL with PostgreSQL URL from DIRECT_URL or novelhermes_POSTGRES_PRISMA_URL
- Fixed .env.local: Updated DATABASE_URL to use pgbouncer pooled connection (port 6543)
- Changed default AI model from qwen/qwen2.5-72b-instruct (404) to meta/llama-3.3-70b-instruct (works)
- Fixed package.json dev script: Removed broken env var extraction, added --webpack and --max-old-space-size=4096
- Pushed Prisma schema to Supabase PostgreSQL database
- Optimized API routes: Created db-utils.ts with light/full include patterns to reduce memory usage
- Split spark generation: AI generation (no DB) + separate DB save calls to avoid memory spikes
- Removed heavy nested include from spark route response

Stage Summary:
- Database connection now works with both local dev and Vercel
- Spark generation (AI) works correctly with meta/llama-3.3-70b-instruct model
- Server stability improved by using webpack mode + 4GB memory limit
- Spark save flow: AI generation → separate PUT requests for project/characters
