# Machine Learning Foundations Course Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Machine Learning Foundations Concourse's first complete learner-facing course: clickable, durable, source-attributed, and genuinely instructive.

**Architecture:** Preserve the 33-activity graph and session engine. Add optional source metadata to activities, derive course progress from persisted sessions, opt only Machine Learning Foundations into a course-home UI, prepend teaching blocks to its existing activities, and render sources through a reusable learner-support component.

**Tech Stack:** TypeScript 6, React 19, Zod 4, Vitest 4, Testing Library, Vite 8, Tauri 2.

## Global Constraints

- Preserve all six modules, 33 activity IDs, responses, evaluations, completion policies, and authored next edges.
- `PersistentLearningService` is the only learner-progress writer. Add no course-progress store, browser key, or desktop file.
- `sourceReferences` is optional for generic subjects; every Machine Learning Foundations activity has one adapted Google ML Crash Course `CC-BY-4.0` reference.
- Use only HTTPS Google ML Crash Course adaptation with visible attribution. Dive into Deep Learning is `CC-BY-SA-4.0` further reading only. Never copy the Goodfellow/Bengio/Courville textbook.
- No accounts, hosted state, cloud sync, payments, ratings, marketplace, or social functionality.
- Do not alter the approved spec or any generated design document.
- Run targeted Prettier checks only; preserve unrelated worktree changes.
- Every behavior change is red-green-refactor and ends with the listed focused commit.

## Dependency and Concurrency Rules

```text
1 source contract -> 3 teaching foundation -> 6 support component -> 7 lesson UI
2 course progress -> 4 overview hook -> 5 course home
3 + 5 + 6 -> 7 -> 8..12 content -> 13 browser and desktop proof
```

- Tasks 1 and 2 can run in parallel.
- Tasks 8-12 are strictly sequential because each edits `course-content.ts` and `subject.test.ts`.
- Task 13 starts only after every prior task is committed and `git status --short` is empty.

## Shared Interfaces and Sources

```ts
type ActivitySourceReference = Readonly<{
  title: string
  url: string
  attribution: string
  license: 'CC-BY-4.0' | 'CC-BY-SA-4.0'
  use: 'adapted' | 'further-reading'
}>

type CourseModuleStatus = 'start' | 'current' | 'up-next' | 'complete'
type CourseModuleProgress = Readonly<{
  moduleId: ModuleId
  status: CourseModuleStatus
  completedActivityCount: number
  activityCount: number
  prerequisiteModuleTitle: string | null
}>
type CourseProgress = Readonly<{
  subjectId: SubjectId
  sessionId: SessionId | null
  nextActivityId: ActivityId | null
  modules: readonly CourseModuleProgress[]
}>
```

Use these exact Google source URLs in `course-content.ts`:

```ts
const googleSources = {
  introduction: 'https://developers.google.com/machine-learning/intro-to-ml',
  production:
    'https://developers.google.com/machine-learning/crash-course/production-ml-systems',
  linear:
    'https://developers.google.com/machine-learning/crash-course/linear-regression',
  loss: 'https://developers.google.com/machine-learning/crash-course/linear-regression/loss',
  gradient:
    'https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent',
  logistic:
    'https://developers.google.com/machine-learning/crash-course/logistic-regression',
  threshold:
    'https://developers.google.com/machine-learning/crash-course/classification/thresholding',
  recall:
    'https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall',
  generalization:
    'https://developers.google.com/machine-learning/crash-course/overfitting',
  neural:
    'https://developers.google.com/machine-learning/crash-course/neural-networks',
  hidden:
    'https://developers.google.com/machine-learning/crash-course/neural-networks/nodes-hidden-layers',
  backprop:
    'https://developers.google.com/machine-learning/crash-course/neural-networks/backpropagation',
} as const
```

Every teaching entry prepends exactly these blocks before its existing authored prompt:

```ts
blocks: [
  {
    kind: 'callout',
    purpose: 'mental-model',
    title: 'Core idea',
    body: coreIdea,
  },
  {
    kind: 'callout',
    purpose: 'observation',
    title: 'See it',
    body: workedExample,
  },
]
```

### Task 1: Add the activity source contract

**Files:** Modify `src/core/contracts/activity.schema.ts`, `src/core/contracts/contracts.test.ts`.

- [ ] Add a failing test that accepts a CC-BY Google HTTPS reference and rejects `http://example.com` and license `MIT`; also assert activities without sources remain valid.
- [ ] Run `npx vitest run src/core/contracts/contracts.test.ts`; expect failure because strict activity validation rejects `sourceReferences`.
- [ ] Add `ActivitySourceReferenceSchema` with nonempty title/attribution, HTTPS URL validation, `CC-BY-4.0 | CC-BY-SA-4.0`, and `adapted | further-reading`; add `sourceReferences: z.array(ActivitySourceReferenceSchema).min(1).optional()` to `ActivityDefinitionSchema`.
- [ ] Rerun that test and `npx prettier --check` on both files; expect PASS and formatted files.
- [ ] Commit `feat: add attributed activity sources`.

### Task 2: Add the pure course-progress projection

**Files:** Create `src/application/course-progress.ts`, `src/application/course-progress.test.ts`; modify `src/application/learnt-application.types.ts`, `src/application/learnt-application.ts`, `src/application/learnt-application.test.ts`.

- [ ] Write failing tests for no session (`start`, then five `up-next` modules), an active Module 2 session (Module 1 `complete`, Module 2 `current`, next ID `orient-linear-prediction`), and newest completed-session selection.
- [ ] Run `npx vitest run src/application/course-progress.test.ts src/application/learnt-application.test.ts`; expect missing-function failure.
- [ ] Implement `buildCourseProgress({ subject, records })`. Sort by `session.lastActiveAt`; choose newest active, otherwise newest completed. Count completed activity progress per module; no record starts Module 1, active record marks its module current, completed record marks all complete. Freeze the cloned result.
- [ ] Implement `getCourseProgress({ subjectId })` in `LearntApplication`: scan persisted records, use `buildSessionLibrarySnapshot` to retain ready sessions for that subject, then call the pure function.
- [ ] Rerun focused tests and `npm run typecheck`; expect PASS. Commit `feat: derive course progress from sessions`.

### Task 3: Create the teaching adapter and complete Module 1

**Files:** Create `src/subjects/machine-learning-foundations/course-content.ts`; modify `subject.ts`, `subject.test.ts` in the same directory.

- [ ] Write a failing test that all five `the-learning-system` activities have two leading callouts and one adapted CC-BY source.
- [ ] Run `npx vitest run src/subjects/machine-learning-foundations/subject.test.ts`; expect failure.
- [ ] Implement `applyMachineLearningFoundationsTeaching(activities)` so it prepends content blocks and sets `sourceReferences` without touching responses/evaluations/edges. Wrap the existing activities literal with it.
- [ ] Add exact learner copy: learning loop uses boss attempts, serving reads fixed parameters, system parts distinguishes feature/target/hyperparameter, vague task requires unit/inputs/target/evaluation, and build-risk frames a pull request with recall. Use `introduction` for the first, third, fourth and `production` for the second and fifth.
- [ ] Rerun the subject test and targeted Prettier; expect PASS. Commit `feat: teach the machine learning system module`.

### Task 4: Load course progress in the overview hook

**Files:** Modify `src/ui/app/learnt-application-client.ts`, `src/ui/app/LearntApplicationProvider.test.tsx`, `src/ui/hooks/use-subject-overview.ts`; create `src/ui/hooks/use-subject-overview.test.ts`.

- [ ] Write a failing hook test expecting `{ overview, sessionLibrary, courseProgress }` and a mapped error when `getCourseProgress` rejects.
- [ ] Run that test; expect failure because the data property is absent.
- [ ] Add `'getCourseProgress'` to the client pick and an unused rejecting provider stub. Use `Promise.all` for `getSubjectOverview`, `listSessions`, and `getCourseProgress({ subjectId })`, retaining the current request-ID guard.
- [ ] Rerun hook/provider tests and `npm run typecheck`; expect PASS. Commit `feat: load course progress with subject overview`.

### Task 5: Build the dedicated course home

**Files:** Create `src/ui/screens/MachineLearningCourseHome.tsx`; modify `src/ui/screens/SubjectOverviewScreen.tsx`, `src/ui/styles/global.css`, `src/ui/app/App.product-flow.test.tsx`.

- [ ] Write a failing product-flow test: Module 2 opens a preview with `Complete The Learning System first.`, no bypass button, Start course reaches orientation, and a completed Module 1 changes the primary action to `Continue: Orient to linear prediction`.
- [ ] Run product-flow tests; expect generic overview failure.
- [ ] Implement course home only for `machine-learning-foundations`. Render six native buttons, focus the preview `h2`, show lesson titles, and allow only Start module, Continue module, prerequisite text, or complete text based on `CourseProgress`. Reuse `startSession`, `navigateToSession`, `RecoverableError`, and existing route helpers. Do not render diagnostics, provenance, IDs, capability state, activity kinds, or scaffold levels.
- [ ] Add token-based responsive CSS with full-width 640 px primary controls. Rerun product-flow tests; expect PASS including Logic Basics. Commit `feat: add machine learning course home`.

### Task 6: Add learner-support components

**Files:** Create `src/ui/components/LessonLearningSupport.tsx`, `src/ui/components/LessonLearningSupport.test.tsx`; modify `src/ui/components/index.ts`.

- [ ] Write failing tests for closed `Key ideas` and `Sources and further learning` disclosures, exact source href, Adapted/Further reading labels, attribution/license, and `null` with no sources.
- [ ] Run component tests; expect missing-component failure.
- [ ] Implement `LessonKeyIdeas({ concepts, objectives })` and `LessonSources({ sources })` with native `<details>`, `h2`, visible `Open source` links, no prerequisite labels, and no IDs.
- [ ] Rerun component test; expect PASS. Commit `feat: add learner lesson support panels`.

### Task 7: Integrate support into the lesson path

**Files:** Modify `src/ui/screens/LearningWorkspaceScreen.tsx`, `src/ui/styles/global.css`, `src/ui/app/App.product-flow.test.tsx`.

- [ ] Write failing Machine Learning product assertions for `Core idea`, `See it`, Key ideas, Sources, and absent `Concept context`; confirm normal response submission and advancement still work.
- [ ] Run product-flow tests; expect failure.
- [ ] For only Machine Learning Foundations, render Key ideas before primary blocks and Sources after them before `ActivityResponse`; preserve all response, feedback, remediation, advancement, and session tools. Style source rows with token colors and full-width mobile links.
- [ ] Rerun product flow and targeted Prettier; expect PASS; Logic retains Concept context. Commit `feat: teach machine learning lessons in the session flow`.

### Task 8: Complete Linear Models as Functions

**Files:** Modify `course-content.ts`, `subject.test.ts` under `src/subjects/machine-learning-foundations`.

- [ ] Add failing Module 2 completeness test, run it, then add teaching entries for linear equation, substitution, positive weight direction, residual `7 - 9 = -2`, and jump-height symbol mapping. Use `googleSources.linear` for all five.
- [ ] Rerun subject tests; expect PASS with current numeric checks unchanged. Commit `feat: teach linear model lessons`.

### Task 9: Complete Loss, Gradients, and Optimization

**Files:** Modify the same `course-content.ts` and `subject.test.ts`.

- [ ] Add failing Module 3 seven-entry test, run it, then add loss/gradient, MSE `[2,4]` versus `[3,3]`, negative-gradient direction, `2 - .1 * 3 = 1.7`, large-rate divergence, forward/loss/backward/step order, and batch/epoch copy. Use `loss` for first two and `gradient` for five remaining entries.
- [ ] Rerun subject tests; expect PASS including MSE and gradient smoke checks. Commit `feat: teach optimization lessons`.

### Task 10: Complete Classification, Scores, and Probability

**Files:** Modify the same `course-content.ts` and `subject.test.ts`.

- [ ] Add failing Module 4 five-entry test, run it, then add score/probability/threshold, positive-logit, lower-threshold, probability-not-proof, and confident-wrong BCE copy. Use `logistic` except `threshold` for threshold behavior.
- [ ] Rerun subject tests; expect PASS. Commit `feat: teach classification lessons`.

### Task 11: Complete Generalization and Evaluation

**Files:** Modify the same `course-content.ts` and `subject.test.ts`.

- [ ] Add failing Module 5 six-entry test, run it, then add unseen-data generalization, overfitting, underfitting, leakage, recall, and baseline/split/metric plan copy. Use `generalization` except `recall` for metric selection.
- [ ] Rerun subject tests; expect PASS. Commit `feat: teach generalization lessons`.

### Task 12: Complete Deep Learning Bridge and all-course coverage

**Files:** Modify the same `course-content.ts` and `subject.test.ts`.

- [ ] Add failing assertions that every 33 activities has two leading callouts and exactly one adapted CC-BY Google source; run them and observe failure.
- [ ] Add bridge, stacked-linear-without-nonlinearity, computational-graph, autograd, and transformer-loop copy. Use `neural`, `hidden`, and `backprop` sources by activity.
- [ ] Rerun the subject tests and `npm run typecheck`; expect PASS. Commit `feat: complete machine learning course lessons`.

### Task 13: Browser and desktop proof

**Files:** No edit unless a reproducible defect requires a focused failing test and minimal repair.

- [ ] Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `npm run desktop:build`; expect exit code 0 for each.
- [ ] Start Vite hidden with `npm.cmd run dev`. In DevTools at `http://127.0.0.1:5173/`, open a locked module, start course, open Key ideas and Sources, complete orientation, answer serving behavior, return home, and reload. Expect no console errors/warnings, no horizontal scroll at 320/768/1024/1440 px, logical tabs, and no debug/author copy.
- [ ] Launch the packaged executable with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`; inspect the course home and first lesson, reload once, and expect populated `#root` plus zero page/console errors.
- [ ] Stop only task-owned Vite/desktop processes, remove only task-owned diagnostics, run `git status --short` and `git diff --check`, and expect a clean worktree.

## Plan Self-Review

- Course home and non-bypass module behavior: Tasks 2, 4, 5.
- Teaching-first lessons and debug-panel removal: Tasks 3, 6, 7.
- All six modules and 33 activities: Tasks 3, 8-12.
- Attribution/licensing: Tasks 1, 3, 6, 12.
- Session-only progress persistence: Task 2.
- Browser, keyboard, reload, and desktop verification: Tasks 5-7 and 13.

No task relies on an unnamed interface or an unspecified source. The plan contains no incomplete implementation marker, generated-document edit, or broad formatting action.
