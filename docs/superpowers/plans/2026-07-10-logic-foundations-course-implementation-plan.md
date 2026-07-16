# Logic Foundations Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a source-attributed, locally importable Logic Foundations pack with twelve numbered modules, sixty-eight lesson/review/checkpoint nodes, and a real teaching-and-practice flow.

**Architecture:** Author the course as declarative TypeScript content inside the canonical Learnt tree, generate immutable pack documents from that source, and validate the generated directory through the shared SDK before it is imported through the existing course, resource, and PracticePlan surfaces. The generated pack retains `packId: "logic"` and has no subject-specific React code.

**Tech Stack:** TypeScript 6, Node.js file APIs, Vitest 4, `@learnt/learning-pack-contracts`, `@learnt/learning-pack-sdk`, and the existing Learnt resource and PracticePlan runtime.

## Global Constraints

- Do not modify `C:\Projects\Learning\Courses\logic`; it remains the preserved `0.1.0` sibling source until the recovery plan clean-clone gate passes. The canonical authored successor lives at `courses/logic-foundations/` inside Learnt.
- Do not begin course generation until the recovery plan has put contracts and SDK in `packages/`, the shared SDK accepts a README declared with the `documentation` manifest role, and the browser installed-pack lifecycle reload gate passes. Document-only validation and non-durable browser installs are not releasable.
- The final manifest uses `packId: "logic"`, `version: "1.0.0"`, and `license: "CC-BY-4.0"`; every declared file uses its final UTF-8 byte count and lowercase SHA-256.
- Source order and attribution follow _forall x: Calgary_ by P. D. Magnus, Tim Button, Robert Trueman, and Richard Zach, CC BY 4.0, <https://forallx.openlogicproject.org/html/>. Explanations, examples, prompts, distractors, and solutions are original Concourse writing.
- The release has twelve modules, forty-four chapter-derived lessons, twelve `.8` reviews, twelve `.9` checkpoints, exactly 144 learning items, and twenty-six StudySets.
- Do not add a proof parser, free-text proof autograder, executable pack code, account, hosted state, marketplace, or cloud synchronization behavior.
- Start every behavioral task with a focused failing Vitest assertion. Do not stage unrelated dirty paths, including `docs/design/**`, `LEARNT_HANDOFF.md`, or generated design uploads.

## File Structure

```text
content/logic-foundations/
  course.ts                               # Human-authored module and lesson declarations
  course.test.ts                          # Course-shape and source-coverage assertions
scripts/
  build-logic-foundations-pack.ts         # Deterministically emits pack documents
courses/logic-foundations/
  README.md pack.json catalog.json courses.json items.json sets.json
  resources.json theme.json               # Generated, canonical release artifacts
src/ui/app/
  LogicFoundationsCourse.product.test.tsx # Import, navigation, checkpoint, reload proof
```

The hand-maintained authoring interface is:

```ts
export type LogicLesson = Readonly<{
  code: `${number}.${number}`
  nodeId: string
  title: string
  chapters: readonly number[]
  learnerJob: string
  conceptIds: readonly string[]
  objectiveIds: readonly string[]
  explanation: string
  workedExample: string
  guidedPrompt: string
  guidedOptions: readonly string[]
  guidedCorrectOptionId: string
  independentPrompt: string
  independentSolution: string
  commonMistake: string
}>

export type LogicModule = Readonly<{
  code: `${number}.0`
  nodeId: string
  title: string
  prerequisiteConceptIds: readonly string[]
  lessons: readonly LogicLesson[]
  reviewPrompt: string
  checkpointPrompt: string
}>

export const logicFoundationsModules: readonly LogicModule[]
export function buildLogicFoundationsPack(): LearningPackDocuments
export function writeLogicFoundationsPack(
  outputDirectory: string,
): Promise<void>
```

---

### Task 0: Pass the reproducible-validator gate before authoring release data

**Files:** None.

**Dependencies:** Phase 1, Phase 2, and the Phase 3 browser-lifecycle checkpoint in [the recovery plan](C:/Projects/Learning/Learnt/docs/superpowers/plans/2026-07-10-concourse-recovery-and-delivery-plan.md).

- [ ] **Step 1: Prove that Learnt no longer resolves sibling package paths.**

```powershell
rg -n 'file:\.\./learning-pack-(contracts|sdk)' package.json package-lock.json packages
npm --workspace=@learnt/learning-pack-contracts run test
npm --workspace=@learnt/learning-pack-sdk run test
```

Expected: the search has no output and both workspace suites pass.

- [ ] **Step 2: Prove that a documentation-bearing pack validates through the SDK.**

```powershell
node packages/learning-pack-sdk/dist/cli.js validate C:\Projects\Learning\Courses\logic
```

Expected: exit code `0`, without a README or `documentation`-role diagnostic.

- [ ] **Step 3: Prove the browser installed-pack lifecycle matrix before using its delivery path.**

Run: `npm run test -- src/ui/app/browser-learning-pack-directory-import.test.ts src/ui/app/LearningPackLibrary.product.test.tsx`

Expected: focused tests prove import, lesson navigation, reload reconstruction, same-version reinstall, valid upgrade, and invalid-update preservation through the Phase 3 lifecycle implementation.

**Stop/go gate:** Stop course implementation if any prerequisite command fails. Go only when the SDK validates complete file sets and browser reload reconstructs an installed pack.

**Commit boundary:** None.

### Task 1: Create the tested authoring model and deterministic pack writer

**Files:**

- Create: `content/logic-foundations/course.ts`
- Create: `content/logic-foundations/course.test.ts`
- Create: `scripts/build-logic-foundations-pack.ts`
- Modify: `package.json`

**Consumes:** `LearningPackDocuments`, shared schemas, and SDK canonical-document helpers.

**Produces:** the interfaces above and the root script:

```json
"build:logic-foundations": "tsx scripts/build-logic-foundations-pack.ts"
```

- [ ] **Step 1: Write the failing full-course shape test.**

```ts
import { describe, expect, it } from 'vitest'
import { buildLogicFoundationsPack, logicFoundationsModules } from './course'

describe('Logic Foundations source', () => {
  it('defines the declared course shape', () => {
    expect(logicFoundationsModules.map((module) => module.code)).toEqual([
      '1.0',
      '2.0',
      '3.0',
      '4.0',
      '5.0',
      '6.0',
      '7.0',
      '8.0',
      '9.0',
      '10.0',
      '11.0',
      '12.0',
    ])
    const lessons = logicFoundationsModules.flatMap((module) => module.lessons)
    expect(lessons).toHaveLength(44)
    expect(
      lessons.flatMap((lesson) => lesson.chapters).sort((a, b) => a - b),
    ).toEqual([
      ...Array.from({ length: 41 }, (_, index) => index + 1),
      45,
      46,
      47,
    ])
    const pack = buildLogicFoundationsPack()
    expect(pack.items.items).toHaveLength(144)
    expect(
      pack.resources?.resources.filter(
        (resource) => resource.source.kind === 'bibliographic-reference',
      ),
    ).toHaveLength(44)
  })
})
```

- [ ] **Step 2: Run it and confirm the missing authoring model fails.**

Run: `npm run test -- content/logic-foundations/course.test.ts`

Expected: FAIL with a module-resolution error for `./course`.

- [ ] **Step 3: Implement the authoring declarations and writer with Module 1 only.**

Define all interfaces, add `1.0 Logic, Arguments, and Meaning` with `1.1 Arguments`, `1.2 The Scope of Logic`, and `1.3 Other Logical Notions`, and make an interim test expect one module, three lessons, twelve items, and two StudySets. The writer builds original embedded resources and chapter-specific bibliographic references, then invokes the SDK canonical-document helper to calculate manifest hashes and bytes from final UTF-8 output.

- [ ] **Step 4: Restore and run the full-course test.**

Run: `npm run test -- content/logic-foundations/course.test.ts`

Expected: FAIL with twelve expected modules and forty-four expected lessons; this is the red state for the content waves.

- [ ] **Step 5: Commit the reusable boundary.**

```powershell
git add content/logic-foundations/course.ts content/logic-foundations/course.test.ts scripts/build-logic-foundations-pack.ts package.json
git commit -m "feat: add logic course authoring pipeline"
```

### Task 2: Author and generate the propositional-logic half

**Files:** **Mechanical course-pack generation exception.**

- Modify: `content/logic-foundations/course.ts`
- Modify: `content/logic-foundations/course.test.ts`
- Generate: `courses/logic-foundations/{README.md,pack.json,catalog.json,courses.json,items.json,sets.json,resources.json,theme.json}`

**Consumes:** Task 1's authoring model and writer.

**Produces:** Modules 1.0 through 6.0, twenty-two chapter-derived lessons, twelve review/checkpoint nodes, seventy-two learning items, and twelve module-specific StudySets.

- [ ] **Step 1: Add the failing propositional-half assertion.**

```ts
it('generates the complete propositional-logic half', () => {
  const pack = buildLogicFoundationsPack()
  expect(pack.courses.courses[0]?.rootNodes).toHaveLength(6)
  expect(pack.items.items).toHaveLength(72)
  expect(pack.sets.sets).toHaveLength(12)
  expect(
    pack.resources?.resources.every(
      (resource) => resource.provenance?.license === 'CC-BY-4.0',
    ),
  ).toBe(true)
})
```

- [ ] **Step 2: Run the test against Module 1 only.**

Run: `npm run test -- content/logic-foundations/course.test.ts`

Expected: FAIL with six expected modules and seventy-two expected items.

- [ ] **Step 3: Add the exact source-backed lessons and course mechanics.**

| Module | Chapter-derived lessons                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------- |
| 1.0    | 1.1 Arguments; 1.2 The Scope of Logic; 1.3 Other Logical Notions                                                    |
| 2.0    | 2.1 First Steps to Symbolization; 2.2 Connectives; 2.3 Sentences of TFL; 2.4 Ambiguity; 2.5 Use and Mention         |
| 3.0    | 3.1 Characteristic Truth Tables; 3.2 Truth-Functional Connectives; 3.3 Complete Truth Tables; 3.4 Semantic Concepts |
| 4.0    | 4.1 Limitations of TFL; 4.2 Truth Table Shortcuts; 4.3 Partial Truth Tables                                         |
| 5.0    | 5.1 The Idea of Natural Deduction; 5.2 Basic Rules for TFL; 5.3 Constructing Proofs                                 |
| 6.0    | 6.1 Additional Rules for TFL; 6.2 Proof-Theoretic Concepts; 6.3 Derived Rules; 6.4 Soundness and Completeness       |

Each source lesson provides original explanation, worked example, guided diagnosis, independent solution-backed check, and retrieval item. Every module adds `.8` review and `.9` checkpoint. Emit exactly twelve items per module: a five-lesson module uses ten chapter items, one review item, and one checkpoint item; a four-lesson module uses eight chapter items, one orientation item, two review items, and one checkpoint item; a three-lesson module uses six chapter items, one orientation item, two review items, and three checkpoint items. No item is empty or unattached to a concept and objective.

- [ ] **Step 4: Generate, validate, and test the partial pack.**

```powershell
npm run build:logic-foundations
node packages/learning-pack-sdk/dist/cli.js validate courses/logic-foundations
npm run test -- content/logic-foundations/course.test.ts
```

Expected: all commands exit `0`; the generated pack declares README and resources and contains six modules, seventy-two items, and twelve StudySets.

- [ ] **Step 5: Commit the propositional-logic course.**

```powershell
git add content/logic-foundations/course.ts content/logic-foundations/course.test.ts courses/logic-foundations
git commit -m "feat: author logic propositional course"
```

### Task 3: Author first-order language and interpretation modules

**Files:** **Mechanical course-pack generation exception.**

- Modify: `content/logic-foundations/course.ts`
- Modify: `content/logic-foundations/course.test.ts`
- Generate: `courses/logic-foundations/{README.md,pack.json,catalog.json,courses.json,items.json,sets.json,resources.json,theme.json}`

**Consumes:** Task 2's validated pack.

**Produces:** Modules 7.0 through 10.0, thirteen new source lessons, eight review/checkpoint nodes, forty-eight items, and eight StudySets.

- [ ] **Step 1: Add the failing first-order-language assertion.**

```ts
it('adds first-order language and interpretations without prerequisite cycles', () => {
  const pack = buildLogicFoundationsPack()
  expect(pack.courses.courses[0]?.rootNodes).toHaveLength(10)
  expect(pack.items.items).toHaveLength(120)
  expect(pack.sets.sets).toHaveLength(20)
})
```

- [ ] **Step 2: Run it against the six-module pack.**

Run: `npm run test -- content/logic-foundations/course.test.ts`

Expected: FAIL with ten expected modules and 120 expected items.

- [ ] **Step 3: Add the exact modules.**

| Module | Chapter-derived lessons                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------- |
| 7.0    | 7.1 Building Blocks of FOL; 7.2 Sentences with One Quantifier; 7.3 Multiple Generality; 7.4 Identity |
| 8.0    | 8.1 Sentences of FOL; 8.2 Definite Descriptions; 8.3 Ambiguity                                       |
| 9.0    | 9.1 Extensionality; 9.2 Truth in FOL; 9.3 Semantic Concepts                                          |
| 10.0   | 10.1 Using Interpretations; 10.2 Reasoning About Interpretations; 10.3 Properties of Relations       |

Use finite symbolization and interpretation choices for deterministic grading. Use solution-backed manual work for alternative valid translations. Each module adds `.8`, `.9`, twelve items using the fixed allocation in Task 2, one deck, and one mixed quiz.

- [ ] **Step 4: Generate, validate, and test the ten-module pack.**

```powershell
npm run build:logic-foundations
node packages/learning-pack-sdk/dist/cli.js validate courses/logic-foundations
npm run test -- content/logic-foundations/course.test.ts
```

Expected: all commands exit `0`; the pack has ten modules, 120 items, and twenty StudySets.

- [ ] **Step 5: Commit the first-order course data.**

```powershell
git add content/logic-foundations/course.ts content/logic-foundations/course.test.ts courses/logic-foundations
git commit -m "feat: author logic first-order course"
```

### Task 4: Author proof mastery, publish the full pack, and prove the app flow

**Files:** **Mechanical course-pack generation exception.**

- Modify: `content/logic-foundations/course.ts`
- Modify: `content/logic-foundations/course.test.ts`
- Create: `src/ui/app/LogicFoundationsCourse.product.test.tsx`
- Generate: `courses/logic-foundations/{README.md,pack.json,catalog.json,courses.json,items.json,sets.json,resources.json,theme.json}`

**Consumes:** Task 3's validated ten-module pack.

**Produces:** Modules 11.0 and 12.0, twenty-four final items, four review/checkpoint nodes, six final StudySets, version `1.0.0`, and an import-to-reload product proof.

- [ ] **Step 1: Add failing final-course and product-flow tests.**

```ts
it('builds the declared twelve-module release', () => {
  const pack = buildLogicFoundationsPack()
  expect(pack.manifest).toMatchObject({ packId: 'logic', version: '1.0.0' })
  expect(pack.courses.courses[0]?.rootNodes).toHaveLength(12)
  expect(pack.items.items).toHaveLength(144)
  expect(pack.sets.sets).toHaveLength(26)
})

it('imports Logic Foundations, opens 1.1, completes 1.9, and restores it after reload', async () => {
  // Import generated file records with the browser directory adapter.
  // Navigate to node-logic-1-1-arguments, start set-logic-1-checkpoint,
  // complete an item, recreate the client, and assert the same pack and progress.
})
```

- [ ] **Step 2: Run focused tests in the ten-module red state.**

```powershell
npm run test -- content/logic-foundations/course.test.ts src/ui/app/LogicFoundationsCourse.product.test.tsx
```

Expected: FAIL because Modules 11.0 and 12.0, the product test, and final counts do not exist.

- [ ] **Step 3: Add the proof and capstone modules.**

| Module | Chapter-derived lessons                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------- |
| 11.0   | 11.1 Basic Rules for FOL; 11.2 Proofs with Quantifiers; 11.3 Conversion of Quantifiers; 11.4 Rules for Identity           |
| 12.0   | 12.1 Derived Rules; 12.2 Proofs and Semantics; 12.3 Normal Forms; 12.4 Functional Completeness; 12.5 Proving Equivalences |

Use deterministic proof-step ordering and error diagnosis for graded proof work. Use manual proof responses with reviewed derivations and self-check rubrics when multiple derivations are valid. Add a cumulative review and a final transfer set; complete README attribution and emit `1.0.0`.

- [ ] **Step 4: Run full pack and product verification.**

```powershell
npm run build:logic-foundations
node packages/learning-pack-sdk/dist/cli.js validate courses/logic-foundations
npm run test -- content/logic-foundations/course.test.ts src/ui/app/LogicFoundationsCourse.product.test.tsx
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all commands exit `0`; SDK reports `logic` `1.0.0`; the product test proves import, lesson navigation, checkpoint practice, reload, and restored local progress.

- [ ] **Step 5: Package and inspect without overwriting the preserved sibling pack.**

```powershell
$archive = 'artifacts/logic-foundations-1.0.0.learntpack'
node packages/learning-pack-sdk/dist/cli.js pack courses/logic-foundations --out $archive
node packages/learning-pack-sdk/dist/cli.js inspect $archive
```

Expected: inspection reports `logic` 1.0.0, 144 items, resources, and 26 StudySets.

- [ ] **Step 6: Commit the complete course release.**

```powershell
git add content/logic-foundations/course.ts content/logic-foundations/course.test.ts src/ui/app/LogicFoundationsCourse.product.test.tsx courses/logic-foundations artifacts/logic-foundations-1.0.0.learntpack
git commit -m "feat: deliver logic foundations course"
```

## Completion Gate

Release only after the source directory and archive both validate through the workspace SDK, the source model has twelve modules and forty-four mapped core lessons, the generated course has sixty-eight child lesson nodes, 144 items, and 26 StudySets, and the browser product test proves import, navigation, checkpoint practice, reload, and local progress restoration. A passing document-only import is insufficient.
