# Spec and build

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification
<!-- chat-id: 226608dc-c25e-42b5-93fd-00642077548c -->

Assess the task's difficulty, as underestimating it leads to poor outcomes.
- easy: Straightforward implementation, trivial bug fix or feature
- medium: Moderate complexity, some edge cases or caveats to consider
- hard: Complex logic, many caveats, architectural considerations, or high-risk changes

Create a technical specification for the task that is appropriate for the complexity level:
- Review the existing codebase architecture and identify reusable components.
- Define the implementation approach based on established patterns in the project.
- Identify all source code files that will be created or modified.
- Define any necessary data model, API, or interface changes.
- Describe verification steps using the project's test and lint commands.

Save the output to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach
- Source code structure changes
- Data model / API / interface changes
- Verification approach

If the task is complex enough, create a detailed implementation plan based on `{@artifacts_path}/spec.md`:
- Break down the work into concrete tasks (incrementable, testable milestones)
- Each task should reference relevant contracts and include verification steps
- Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function).

Save to `{@artifacts_path}/plan.md`. If the feature is trivial and doesn't warrant this breakdown, keep the Implementation step below as is.

---

### [x] Step: Merge Feature Branch
<!-- chat-id: ce6783f5-1528-4c2c-a8f8-e8cbaa910f3c -->

Merge Claude's work from `feature/issue-28-target-speed-refinement` branch.

**Tasks:**
- Merge or rebase the feature branch to get completed work
- Resolve any conflicts if present

**Verification:**
- Confirm ConfigPage metronome settings have ♪= prefix
- Confirm ConfigPage table headers show "Target (♪)"
- Confirm PracticePage has formatBpm helper function

---

### [x] Step: Backend API Enhancement
<!-- chat-id: 6b972733-5777-4f17-8ee9-8a5d949ffb47 -->

Add BPM tracking data to `/practice-history` endpoint.

**Changes:**
- Update `PracticeHistoryItem` model with `max_practiced_bpm` and `target_bpm` fields
- Query max practiced_bpm from practice entries
- Include current target_bpm from scale/arpeggio

**Files to modify:**
- `backend/routes/practice.py`

**Verification:**
- Test API endpoint returns new fields
- Verify max BPM calculation is correct

---

### [x] Step: Frontend Types Update
<!-- chat-id: 120ac40c-a0a7-45b0-8caa-d8e88fcb8099 -->

Update TypeScript interfaces for BPM history data.

**Changes:**
- Add `max_practiced_bpm: number | null` to PracticeHistoryItem
- Add `target_bpm: number | null` to PracticeHistoryItem

**Files to modify:**
- `frontend/src/types/index.ts`

**Verification:**
- Run `npm run type-check`

---

### [x] Step: PracticePage Layout Restructure
<!-- chat-id: 423e2ec6-7c35-4680-a077-ec58a9adb984 -->

Restructure PracticePage item display per user requirements.

**Changes:**
1. Update item display format: "D♭ minor melodic, 3 octaves, ♪ = 60" (replace hyphen with comma, append BPM)
2. Remove separate target display from header
3. Move BPM recording controls below slurred/separate checkboxes
4. Remove inline ♩ display from BPM input (keep only ♪)

**Files to modify:**
- `frontend/src/pages/PracticePage.tsx`

**Verification:**
- Item name shows comma-separated format with BPM
- BPM checkbox appears below checkboxes, not in header
- No ♩ display next to BPM input

---

### [x] Step: PracticePage History Display
<!-- chat-id: 35335bc9-c3f1-425c-9223-94770a01deef -->

Add practice history BPM display under item names.

**Changes:**
- Fetch practice history for current practice set items
- Create map of item → history data
- Display under item name:
  - "Practiced at target speed" if max_practiced_bpm === target_bpm
  - "Practiced at ♪=X, ♩=Y" otherwise

**Files to modify:**
- `frontend/src/pages/PracticePage.tsx`

**Verification:**
- Practice item with BPM, submit session
- Generate new set with same item
- Verify history text appears under item name

---

### [x] Step: CSS Updates
<!-- chat-id: 8bd5dccb-2636-41ce-9cdd-d5655414073e -->

Update styles for new layout.

**Changes:**
- Add `.practice-bpm-section` for moved BPM controls
- Add `.practice-history-info` for history text (small, muted)
- Adjust `.practice-item-header` layout
- Clean up `.bpm-crotchet-inline` (no longer used)

**Files to modify:**
- `frontend/src/App.css`

**Verification:**
- Visual review of practice page
- Check layout at different screen sizes

---

### [ ] Step: Final Verification

Run all checks and perform comprehensive testing.

**Tasks:**
1. Run `npm run build`
2. Run `npm run type-check`
3. Run `npm run lint`
4. Manual testing:
   - Item format: "D♭ minor melodic, 3 octaves, ♪ = 60"
   - BPM checkbox below slurred/separate checkboxes
   - No ♩ in BPM input section
   - History display after practicing with BPM
   - "Practiced at target speed" when BPM matches

**Deliverable:**
- Create `{@artifacts_path}/report.md` with implementation summary, testing, and issues
