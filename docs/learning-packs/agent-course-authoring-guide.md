# Agent Course Authoring Guide

## Purpose

This guide tells agents how to create Learnt course packs from a topic, outline,
textbook, open educational resource, or user-supplied source material.

The target is not "make a pile of flashcards." The target is:

```text
source material
  -> course architecture
  -> concept graph
  -> objectives
  -> curriculum
  -> learning items
  -> study sets
  -> validated learning pack
```

Learnt may label the experience as Route, Loop, Transfer, and Modes in the UI,
but authored pack files must use the stable contract names below.

## Canonical Pack Layout

A course pack folder should look like this:

```text
my-course-pack/
  README.md
  pack.json
  catalog.json
  courses.json
  items.json
  sets.json
  theme.json              optional
  resources.json          optional
  migrations.json         optional
  assets/                 optional
```

Required public JSON files:

- `pack.json`: pack identity, version, capabilities, file manifest, hashes.
- `catalog.json`: subjects, concepts, and learning objectives.
- `courses.json`: courses and nested curriculum nodes.
- `items.json`: flashcards, quizzes, recall prompts, readings, and checks.
- `sets.json`: decks, quizzes, reviews, practice sets, and exams.

Optional public JSON files:

- `theme.json`: constrained visual hints only.
- `resources.json`: readings, textbook references, links, videos, audio, or embedded explanations.
- `migrations.json`: version-to-version pack migration metadata.

If an optional public JSON file exists, `pack.json.files` must declare it with
the matching role. Example: `theme.json` must be listed with role `theme`.

## Agent Contract

Agents creating courses must follow these rules:

- Work from the user's stated audience, goal, and supplied materials.
- Prefer open-license, public-domain, or user-supplied materials.
- Track source titles, URLs, licenses, chapters, and page ranges when available.
- Do not copy long source passages into pack content. Write original explanations and questions.
- Treat copyrighted or user-supplied textbooks as reference material unless the user explicitly asks for excerpts and the excerpt is short.
- Build the course architecture before writing items.
- Keep stable machine IDs separate from display titles.
- Validate the pack before telling the user it is ready for Transfer.

## Source Intake

Before authoring, create a source intake note in your working context. It does
not need to ship in the pack unless the user wants it.

Capture:

- Course topic.
- Target learner.
- Desired depth.
- Source materials and license status.
- Topics that are in scope.
- Topics that are out of scope.
- Required practical outcomes.
- Preferred tone and difficulty.
- Constraints such as age level, time budget, exam prep, or project focus.

If the user supplies textbooks:

- Ask whether the course should follow the book chapter order or a better learning order.
- Use the book for structure, vocabulary, examples, and sequencing.
- Convert the material into original explanations, questions, and exercises.
- Cite the book in `README.md` or `resources.json` as a bibliographic reference when appropriate.

## Course Architecture First

Every serious course needs an architecture pass before JSON authoring.

Use this sequence:

1. Define the learner promise.
2. Define the exit performance.
3. Build the course spine.
4. Build the concept graph.
5. Build the objective map.
6. Build the curriculum nodes.
7. Assign source coverage.
8. Assign learning item types.
9. Assign review and practice sets.
10. Validate coverage and prerequisites.

### Learner Promise

Write one sentence:

```text
After this course, the learner can [perform specific task] using [core ideas] in [real context].
```

Bad:

```text
Learners will understand linear algebra.
```

Good:

```text
Learners can use vectors, matrices, and linear transformations to explain basic data and machine learning operations.
```

### Exit Performance

Define the final observable work. Examples:

- Solve a multi-step problem.
- Explain a system from first principles.
- Build a small project.
- Diagnose a mistake.
- Read a primary source or textbook chapter.
- Pass a cumulative exam.

The final module and exam set should test this exit performance.

## Numbered Course Spine

Use a numbered spine while designing the course. The spine is not required by
the JSON schema, but it keeps agents from making shallow or disorganized packs.

Recommended format:

```text
1.0 Orientation and prerequisites
1.1 First key idea
1.2 First worked example
1.3 First practice checkpoint
...
12.7 Advanced synthesis
12.8 Final review
12.9 Final transfer task
```

Interpretation:

- Major number: unit, module, or chapter.
- Minor number: lesson, section, checkpoint, or assessment.
- `.0`: module overview, prerequisites, and why it matters.
- `.1` to `.7`: teach and practice core ideas.
- `.8`: review, consolidation, or mixed practice.
- `.9`: transfer task, checkpoint, exam, or project.

For short packs, use fewer modules. For a full textbook-sized course, 8 to 12
major modules is usually enough. Do not create 80 shallow modules when 12 strong
modules with nested lessons would be clearer.

### Course Spine Template

For each numbered unit or lesson, fill this in:

```text
Code:
Title:
Learner job:
Prerequisites:
Concepts introduced:
Concepts reinforced:
Objectives:
Source coverage:
Teach resources:
Learning items:
Study sets:
Common mistakes:
Exit check:
```

Example:

```text
2.3 Matrix times vector
Learner job: Predict how a matrix transforms a vector.
Prerequisites: vectors, scalar multiplication, coordinate pairs.
Concepts introduced: matrix-vector-product.
Concepts reinforced: vector, linear-transformation.
Objectives: multiply-matrix, interpret-linear-transformation.
Source coverage: Textbook chapter 2.2, examples 2.4 to 2.7.
Teach resources: embedded explanation, worked example, optional video.
Learning items: 2 flashcards, 2 single-choice checks, 1 numeric recall.
Study sets: module-2-review.
Common mistakes: row/column order, treating matrices as tables only.
Exit check: Given a 2x2 matrix and vector, compute and explain the result.
```

## Concept Graph

Concepts are durable labels for learning, review, search, and remediation.

Every concept needs:

- `conceptId`: stable kebab-case ID.
- `title`: short display name.
- `summary`: one clear sentence.
- `tags`: topic labels.
- `prerequisiteConceptIds`: earlier concepts required first.
- `relatedConceptIds`: non-prerequisite conceptual links.

Rules:

- Keep concept IDs stable across versions.
- Do not use display titles as IDs.
- Avoid duplicate concepts with slightly different names.
- Do not reference a missing concept.
- Do not create prerequisite cycles.
- Add prerequisite concepts before dependent concepts.

Good concept granularity:

- `vector`
- `scalar`
- `dot-product`
- `matrix-vector-product`
- `linear-transformation`

Too broad:

- `math`
- `chapter-two`

Too narrow:

- `the-blue-arrow-in-example-2-3`

## Objectives

Objectives define what learners must be able to do.

Every objective needs:

- `objectiveId`: stable kebab-case ID.
- `statement`: observable learner action.
- `successCriteria`: concrete review criteria.
- `conceptIds`: concepts needed for the objective.

Rules:

- Start objectives with verbs: define, compute, compare, explain, diagnose, build, prove, interpret.
- Avoid vague verbs like understand, know, learn, appreciate.
- Every objective should be testable by at least one item.
- Every item must reference at least one objective.
- Every curriculum node should reference objectives when it contains learning items.

Example:

```json
{
  "objectiveId": "multiply-matrix-vector",
  "statement": "Compute a matrix-vector product and explain the transformation it represents.",
  "successCriteria": [
    "Uses row-by-column multiplication correctly.",
    "Identifies the input and output vector.",
    "Explains the result as a transformation, not just arithmetic."
  ],
  "conceptIds": ["matrix", "vector", "linear-transformation"]
}
```

## Curriculum Nodes

`courses.json` holds the authored course route.

A course has:

- `courseId`
- `title`
- `summary`
- `subjectIds`
- `tags`
- `rootNodes`

Nodes can be:

- `module`
- `unit`
- `chapter`
- `lesson`
- `section`
- `custom`

Each `CurriculumNode` needs:

- `nodeId`
- `kind`
- `title`
- `summary`
- `itemIds`
- `conceptIds`
- `objectiveIds`
- `children`
- `customKindLabel`
- optional `entries`

Recommended hierarchy:

```text
course
  module 1.0
    lesson 1.1
    lesson 1.2
    lesson 1.8 review
    lesson 1.9 checkpoint
  module 2.0
    lesson 2.1
    lesson 2.2
```

Rules:

- Put nested course architecture in `children`.
- Use `entries` when resources, items, study sets, and child nodes need an exact mixed order.
- Keep `itemIds` in authored learning order.
- Every `itemId` must exist in `items.json`.
- Every `conceptId` and `objectiveId` must exist in `catalog.json`.
- Prefer stable semantic node IDs such as `lesson-matrix-vector-product`, not `node-17`.

## Learning Items

`items.json` contains the actual prompts and activities.

Every item needs:

- `itemId`
- `learningRevision`
- `title`
- `promptBlocks`
- `response`
- `evaluation`
- `reviewedSolutionBlocks`
- `conceptIds`
- `objectiveIds`
- `allowedPlayModes`

Critical rule:

```text
Every learning item must have at least one conceptId and at least one objectiveId.
```

Learnt's runtime subject registry rejects imported activities without
objectives.

### Content Blocks

Use these block kinds:

- `text`
- `question`
- `code`
- `equation`
- `callout`
- `image`
- `audio`

For text-only packs, every block still needs:

```json
{
  "kind": "question",
  "text": "What is a vector?",
  "language": null,
  "calloutRole": null,
  "assetId": null,
  "altText": null
}
```

Do not put HTML, CSS, JavaScript, or executable code into content blocks.

## Item Recipes

### Flashcard

Use for quick recall, definitions, contrasts, and review.

Recommended shape:

- `response.kind`: `self-grade`
- `evaluation.kind`: `self-grade`
- `allowedPlayModes`: `["flashcard", "self-grade-review"]`
- front: primary `question` block
- back: `reviewedSolutionBlocks`

Use flashcards for:

- definitions
- formula meaning
- vocabulary
- one-step recognition
- misconception checks

Do not use flashcards for multi-step procedures unless the back explains the
worked steps.

### Single Choice Quiz

Use when exactly one answer is correct.

- `response.kind`: `single-choice`
- `evaluation.kind`: `choice-selection`
- `correctOptionIds`: one option ID
- `allowedPlayModes`: include `single-choice-quiz`

Use strong distractors based on common mistakes.

### Multiple Choice Quiz

Use when more than one answer can be correct.

- `response.kind`: `multiple-choice`
- `evaluation.kind`: `choice-selection`
- `correctOptionIds`: two or more option IDs when appropriate
- `allowedPlayModes`: include `multiple-choice-quiz`

Make the prompt explicit:

```text
Select all that apply.
```

### Text Recall

Use for short constructed responses.

- `response.kind`: `text`
- `evaluation.kind`: `exact-text`
- `acceptedAnswers`: include canonical variants
- `allowedPlayModes`: include `text-recall`

Use only when exact matching is fair. For open explanations, use self-grade or
manual completion instead.

### Number Recall

Use for calculations.

- `response.kind`: `number`
- `evaluation.kind`: `numerical-tolerance`
- `expectedNumber`: target value
- `absoluteTolerance`: acceptable error
- `allowedPlayModes`: include `number-recall`

Include units in the prompt or `numberInput.unitLabel`.

### Manual Read

Use for readings, explanations, examples, and reflective prompts.

- `response.kind`: `none`
- `evaluation.kind`: `manual-completion`
- `allowedPlayModes`: include `manual-read`

Manual-read items should still have `conceptIds` and `objectiveIds`.

## Study Sets

`sets.json` defines reusable practice groupings.

Kinds:

- `deck`
- `quiz`
- `review`
- `practice`
- `exam`

Ordering:

- `authored`
- `shuffle`
- `adaptive`

Selection can be explicit:

```json
{
  "kind": "explicit",
  "itemIds": ["item-vector-add", "item-vector-scale"]
}
```

Or rule-based:

```json
{
  "kind": "rule",
  "include": {
    "subjectIds": ["linear-algebra"],
    "courseIds": ["linear-algebra-course"],
    "nodeIds": [],
    "conceptIds": ["vector"],
    "objectiveIds": [],
    "allowedPlayModes": ["flashcard"],
    "tags": []
  },
  "exclude": {
    "itemIds": [],
    "conceptIds": [],
    "objectiveIds": [],
    "tags": []
  },
  "limit": 12
}
```

Recommended sets per course:

- one deck per module
- one quiz per module
- one cumulative review set
- one weak-items practice set if the app supports it
- one final exam or transfer set

## Resources From Textbooks And Open Sources

Use `resources.json` when a course has readings, textbook references, videos,
audio, embedded explanations, or source-linked support.

Resource source kinds include:

- `embedded-content`
- `external-link`
- `external-video`
- `external-audio`
- `bibliographic-reference`
- `interactive-reference`
- `pack-asset`

### Downloadable Lab Files

Use `source.kind: "pack-asset"` for a learner-controlled download such as a
notebook, Python script, small dataset, lab README, text file, or environment
YAML. A pack that uses this source must declare the required capability
`learning-resource.pack-asset@1`.

The source `assetId` must resolve to exactly one `pack.json.files` entry with
role `asset`. The source and manifest media types must match. Version 1 accepts
only these pairs:

| Extension       | Media type                 |
| --------------- | -------------------------- |
| `.ipynb`        | `application/x-ipynb+json` |
| `.py`           | `text/x-python`            |
| `.csv`          | `text/csv`                 |
| `.md`           | `text/markdown`            |
| `.txt`          | `text/plain`               |
| `.yml`, `.yaml` | `application/yaml`         |

`suggestedFileName` is a basename, not a path. It must contain 1 to 128
characters after trimming; must not be `.` or `..`; and must not contain `/`,
`\\`, control characters, a trailing dot, or a trailing space. Its extension
must match the declared media type. Keep each downloadable lab file at or below
10 MiB for desktop delivery.

Concourse validates, stores, and copies these bytes only after the learner
chooses Download. It does not preview, import, execute, or grant trust to the
file. Third-party courses can contain harmful code even when their pack is
structurally valid, so authors must tell learners to inspect notebooks, scripts,
and related files before running them.

Recommended source policy:

- Open-source or public-domain source: cite license and URL.
- User-supplied source: cite title/chapter/page where useful.
- Paid or copyrighted source: use as reference, write original pack content, avoid long excerpts.
- Unknown license: do not assume reuse rights. Link or cite instead of copying.

Use resource links to connect sources to concepts, objectives, or items:

- `primary`
- `prerequisite`
- `explanation`
- `worked-example`
- `remediation`
- `reference`
- `extension`

## Pack Manifest Rules

`pack.json` is the identity and integrity document.

Rules:

- `packId` must be unique and stable.
- `version` must be semantic, such as `0.1.0`.
- `releasedAt` must be an ISO timestamp.
- `license` must match the source rights.
- `capabilities.required` should include `core.learning-pack`.
- Optional files must be declared in `files`.
- Every declared public JSON file needs role, media type, SHA-256 hash, and byte count.
- Hashes must be 64 lowercase hex characters.
- Byte counts must match the actual UTF-8 file bytes.

Common roles:

```text
catalog.json    catalog
courses.json    courses
items.json      items
sets.json       sets
resources.json  resources
theme.json      theme
migrations.json migrations
```

## Theme Rules

`theme.json` is constrained metadata, not app code.

Allowed:

- accent color
- background role
- icon asset ID
- cover asset ID
- display name

Not allowed:

- CSS
- JavaScript
- HTML
- React components
- executable renderer code
- layout instructions that override the app

If `theme.json` exists, declare it in `pack.json.files` with role `theme`.

## ID Conventions

Use lowercase kebab-case IDs.

Good:

```text
linear-algebra
matrix-vector-product
lesson-transformations
item-dot-product-meaning
module-3-review
```

Avoid:

```text
Lesson 1
chapter_two
item123
NewCardFinal
```

ID stability rules:

- Do not rename IDs for cosmetic reasons.
- Change titles freely when needed.
- Increment `learningRevision` when item learning content changes meaningfully.
- Increment pack `version` when publishing an updated pack.
- Preserve old IDs when learner progress should carry forward.

## Quality Bar

A pack is not ready until:

- The course has a real spine, not just disconnected items.
- Every module has a purpose.
- Every lesson has concepts, objectives, and items.
- Every item has at least one concept and objective.
- Every objective is practiced by at least one item.
- Every important concept appears in teaching and practice.
- Quizzes include plausible distractors.
- Flashcards have reviewed backs or solutions.
- Cumulative sets mix older and newer material.
- Sources are cited or tracked.
- Pack validation passes.
- Learnt can register the imported pack.

## Generation Workflow

Use this workflow for a new course:

1. Create source intake notes.
2. Create the numbered course spine.
3. Create the concept graph.
4. Create the objective map.
5. Create the curriculum tree.
6. Create an item plan by node.
7. Draft items.
8. Draft sets.
9. Draft resources and theme metadata.
10. Write or update README.md.
11. Assemble JSON files.
12. Compute manifest hashes and byte counts, including README.md.
13. Validate contract relationships.
14. Validate Learnt runtime registration.
15. Hand off with a summary of scope, source coverage, and known gaps.

## Agent Output Checklist

When finished, report:

- Pack folder path.
- Pack ID and version.
- Course title.
- Number of subjects.
- Number of courses.
- Number of curriculum nodes.
- Number of concepts.
- Number of objectives.
- Number of items by play mode.
- Number of study sets.
- Source materials used.
- Validation command/result.
- Any warnings, such as unsupported optional capabilities.

## Validation Checklist

Before claiming the pack is ready:

- Validate JSON syntax.
- Validate `pack.json.files` against actual files.
- Declare `README.md` exactly once with `assetId: null`, `role: "documentation"`, `mediaType: "text/markdown"`, its SHA-256, and its UTF-8 byte count.
- Confirm every optional public JSON file is declared.
- Confirm every declared hash is actual SHA-256 for the file content.
- Confirm every declared byte count is actual UTF-8 byte length.
- Run shared learning-pack validation.
- Run Learnt import/adaptation validation.
- Register the pack in a clean Learnt application instance when practical.
- Select the parent source folder in Transfer and confirm imported count matches expected pack count.

Known failure patterns:

- `theme.json is provided but is not declared with role theme`
- invalid `sha256` pattern
- missing concept reference
- missing objective reference
- duplicate pack ID
- item has empty `objectiveIds`
- curriculum node references a missing item
- set references an item that does not exist

## Repair Rules

When validation fails:

- Fix source data, not the app, unless the app is clearly rejecting valid contract data.
- Preserve semantic IDs when possible.
- Add missing concepts or objectives instead of deleting meaningful references.
- If two packs share a `packId`, rename the accidental duplicate before import.
- If an item lacks objectives, assign the nearest owning node objective or create a better objective.
- Recompute affected manifest hashes after every JSON edit.
- Rerun validation after every repair pass.

## README.md Template

Every pack should include a short `README.md`. It is a manifest-tracked documentation file, not an asset: add a `pack.json.files` entry whose `path` is `README.md`, `role` is `documentation`, `mediaType` is `text/markdown`, and `assetId` is `null`; compute its `sha256` and `bytes` from the saved file.

```markdown
# Course Title

One paragraph describing what the course teaches and who it is for.

## Audience

Target learner and prerequisites.

## Course Architecture

- Module 1: ...
- Module 2: ...
- Final transfer task: ...

## Sources

- Source title, author, license, URL, chapters/pages used.

## Pack Identity

- packId:
- version:
- license:

## Notes

Known gaps, review status, or planned future modules.
```

## Minimal Course Blueprint

For a small but serious course, aim for:

- 1 subject.
- 1 course.
- 4 to 8 modules.
- 3 to 6 lessons per module.
- 20 to 60 concepts.
- 12 to 40 objectives.
- 80 to 250 learning items.
- 1 deck and 1 quiz per module.
- 1 cumulative review set.
- 1 final exam or transfer task.

For a textbook-sized course, aim for:

- 8 to 12 major modules.
- 8 to 15 concepts per module.
- 3 to 8 objectives per module.
- 10 to 25 items per module.
- regular `.8` review lessons and `.9` transfer checkpoints.

Depth matters more than item count. A strong course teaches, checks, reviews,
and transfers. It does not just ask trivia.
