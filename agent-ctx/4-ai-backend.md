# Task 4 - AI Backend Agent Work Record

## Task
Update AI outline generation functions and API routes for the new hierarchical structure (卷→阶段→单元→章) with plot lines.

## Files Modified

### 1. `/src/lib/ai.ts`
- **Replaced** `generateOutline` → `generateHierarchicalOutline`
  - Generates full hierarchy: volumes → stages → units → chapters
  - Includes plotLines (1 main + 1-2 side) with plotPoints containing targetLevel/targetOrder
  - Uses `max_tokens: 4096` for larger output
  - AI prompt enforces strict JSON format with detailed structure requirements
- **Added** `generateUnitChapterPlan`
  - Generates chapters for a specific unit
  - Takes unit info + project context (including plotLines)
  - Returns chapters with plotPoints and beats
- **Kept unchanged**: `generateSparkExpansion`, `generateBeats`, `extractJSON`, `withRetry`

### 2. `/src/app/api/ai/outline/route.ts`
- Replaced `generateOutline` import with `generateHierarchicalOutline`
- Clears existing volumes and plotLines (cascade deletes handle stages/units/chapters/beats/plotPoints)
- Creates full hierarchy using nested loops with ID tracking maps
- ID lookup maps: volumeIdMap, stageIdMap (compound key), unitIdMap (compound key), chapterIdMap (compound key)
- PlotPoint targetOrder resolution with fallback to first entity of that level
- Returns project with deep nested includes (volumes→stages→units→chapters→storyBeats + plotLines→plotPoints)

### 3. `/src/app/api/ai/unit-plan/route.ts` (NEW)
- POST handler accepts `{ unitId, projectId }`
- Fetches unit with parent chain (stage→volume) for context
- Fetches project with plotLines→plotPoints
- Calls `generateUnitChapterPlan` AI function
- Clears existing chapters under unit, creates new ones with plotPoints (JSON) and beats
- Returns full nested project data

### 4. `/src/app/api/ai/beats/route.ts`
- **No changes needed** - queries by chapterId, works with new Chapter.unitId structure

### 5. `/src/app/api/ai/writing-assist/route.ts`
- Added plotPoints parsing from `chapter.plotPoints` (JSON string → array → numbered list)
- Added `剧情要点` context to continue, suggest, and dialogue prompts
- Rewrite mode left unchanged (contextual, doesn't need plot points)

## Validation
- ESLint: passed with no errors
- Dev server: running successfully on port 3000
