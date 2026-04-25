# Task 7 - API Fix Agent Work Record

## Task: Fix all API routes that still reference the old `chapters` relation on NovelProject

## Changes Made

### 1. `/src/app/api/ai/hermes/route.ts` (MAJOR rewrite)
- **Import**: Changed `generateOutline` → `generateHierarchicalOutline`
- **Added `PROJECT_INCLUDE`** constant with full nested include structure (volumes→stages→units→chapters→storyBeats + plotLines→plotPoints)
- **Added `flattenChapters()`** helper function to extract flat chapter array from hierarchical project data
- **Replaced 9 instances** of `include: { chapters: ... }` on NovelProject with `include: PROJECT_INCLUDE`
- **`generate_outline` tool**: Complete rewrite - now calls `generateHierarchicalOutline`, creates full hierarchy (Volume→Stage→Unit→Chapter→StoryBeat + PlotLine→PlotPoint)
- **`generate_genre_outline` tool**: Now creates default Volume→Stage→Unit structure before placing chapters (chapters need unitId)
- **`analyze_project_state` tool**: Uses `flattenChapters(project)` instead of `project.chapters`
- **`validate_readiness` tool**: Uses `flattenChapters(project)` instead of `project.chapters`
- **`suggest_next_step` tool**: Uses `flattenChapters(project)` before passing to `analyzeWorkflowStage`
- **Main POST handler**: Uses `include: PROJECT_INCLUDE`, flattens chapters for `buildSystemPrompt`, checks `data.volumes` for project updates
- All AI prompt content preserved unchanged

### 2. `/src/app/api/ai/spark/route.ts`
- Replaced `include: { chapters: ... }` with full nested hierarchy include

### 3. Files Already Correct (no changes needed)
- `/src/app/api/ai/outline/route.ts` - already uses hierarchical structure (Task 4)
- `/src/app/api/ai/writing-assist/route.ts` - doesn't query chapters on NovelProject
- `/src/app/api/ai/unit-plan/route.ts` - already uses hierarchical structure (Task 4)

## Verification
- ESLint: zero errors, zero warnings
- No `include: { chapters: ... }` on NovelProject remains in codebase
- All `project.chapters` accesses replaced with `flattenChapters(project)` where needed
