# Logic Foundations Course Design

## Status

Approved for implementation planning on 2026-07-10.

## Goal

Replace the current four-lesson `Logic Foundations` starter pack with a
complete, navigable introductory formal-logic course. A learner must be able to
open an ordered course outline, study chapter-backed lessons, practise each
skill, complete module reviews, and carry local progress through the existing
pack and practice runtime.

The course runs from arguments and truth-functional logic through first-order
logic, interpretations, and natural-deduction proofs. It is designed as a
twelve-module self-paced route, not as a collection of disconnected
flashcards.

## Learner Promise

After completing Logic Foundations, a learner can translate ordinary-language
arguments into truth-functional and first-order notation, test semantic claims,
and construct or diagnose elementary formal proofs using the course's stated
rules.

## Primary Source and Attribution

The primary curriculum spine is _forall x: Calgary_ by P. D. Magnus, Tim
Button, Robert Trueman, and Richard Zach:

- Canonical HTML: <https://forallx.openlogicproject.org/html/>
- License: Creative Commons Attribution 4.0 International (CC BY 4.0).
- Source coverage: Parts I through VII and chapters 45 through 47.
- Optional extension source coverage: modal-logic chapters 42 through 44 and
  the soundness chapter 48.

The source is a full introductory formal-logic textbook with 48 chapters. Its
instructor notes describe a twelve-week semester sequence that covers Parts I
through VII plus chapters 45 through 47. The published source must be
attributed in the pack README and `resources.json` with title, authors,
canonical URL, CC BY 4.0 link, and a statement that Concourse adapted the
organization, examples, and learning activities.

Concourse-authored resources, explanations, examples, prompts, distractors, and
solutions are original writing. The pack must not copy long textbook passages.
When a short quotation is pedagogically necessary, it must be marked as a
quotation, cite its chapter, and remain within the CC BY attribution record.

The published pack remains `packId: "logic"` so learners' existing pack identity
and local evidence can carry forward. The complete course is released as a
semantic-version update from the starter's `0.1.0` release. The pack's
`CC-BY-4.0` license remains accurate only if every included asset and text is
compatible with that license; incompatible material is excluded.

## Scope

### Included

- One `Logic Foundations` course with twelve ordered modules.
- Chapter-derived lessons with learner-facing numeric titles such as `3.2
Truth-functional connectives`.
- Original embedded teaching resources, source-linked readings, worked examples,
  practice items, review sets, module checkpoints, cumulative review, and a
  final transfer task.
- Full propositional-logic and first-order-logic core: translation, truth
  tables, semantic concepts, natural deduction, interpretations, quantifiers,
  and identity.
- Stable concepts, objectives, curriculum nodes, item IDs, and StudySets that
  validate through the shared pack contracts and SDK.
- A source-coverage audit that blocks release when a numbered lesson lacks its
  explicit source record or original-content designation.

### Excluded

- A proof-parser, theorem prover, arbitrary free-text proof grader, or
  pack-provided executable code.
- Accounts, hosted learner state, cloud sync, marketplaces, ratings, payments,
  or external-service dependencies.
- Required modal logic or the advanced soundness chapter in the first release.
- Copying the textbook into pack JSON or presenting book material without the
  required CC BY attribution.

## Course Architecture

The display numbering is authored in curriculum titles. Major numbers identify
modules; minor numbers identify lessons and checkpoints.

- `.0` is the module overview: learner job, prerequisites, vocabulary preview,
  and a short diagnostic.
- `.1` through `.7` are chapter-derived lessons. A module uses only the minor
  numbers required by its source coverage; it does not add empty filler lessons.
- `.8` is a mixed retrieval review.
- `.9` is the module's applied checkpoint or transfer task.

The first release contains twelve module nodes and sixty-eight child lesson
nodes: forty-four core source lessons, twelve reviews, and twelve checkpoints.
Each module contains ten to fifteen learning items, for a total course target of
120 to 180 items. Each module has one authored-order deck and one mixed quiz;
the course also has a cumulative review set and a final mixed transfer set.

### Source-Aligned Module Spine

| Module | Title                          | Source chapters | Chapter-derived lessons                                                                                                   |
| ------ | ------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1.0    | Logic, Arguments, and Meaning  | 1-3             | 1.1 Arguments; 1.2 The Scope of Logic; 1.3 Other Logical Notions                                                          |
| 2.0    | Truth-Functional Language      | 4-8             | 2.1 First Steps to Symbolization; 2.2 Connectives; 2.3 Sentences of TFL; 2.4 Ambiguity; 2.5 Use and Mention               |
| 3.0    | Truth Tables                   | 9-12            | 3.1 Characteristic Truth Tables; 3.2 Truth-Functional Connectives; 3.3 Complete Truth Tables; 3.4 Semantic Concepts       |
| 4.0    | Semantic Reasoning in TFL      | 13-15           | 4.1 Limitations of TFL; 4.2 Truth Table Shortcuts; 4.3 Partial Truth Tables                                               |
| 5.0    | Natural Deduction Foundations  | 16-18           | 5.1 The Idea of Natural Deduction; 5.2 Basic Rules for TFL; 5.3 Constructing Proofs                                       |
| 6.0    | Proof Strategy                 | 19-22           | 6.1 Additional Rules for TFL; 6.2 Proof-Theoretic Concepts; 6.3 Derived Rules; 6.4 Soundness and Completeness             |
| 7.0    | First-Order Language           | 23-26           | 7.1 Building Blocks of FOL; 7.2 Sentences with One Quantifier; 7.3 Multiple Generality; 7.4 Identity                      |
| 8.0    | Expressing First-Order Claims  | 27-29           | 8.1 Sentences of FOL; 8.2 Definite Descriptions; 8.3 Ambiguity                                                            |
| 9.0    | Interpretations                | 30-32           | 9.1 Extensionality; 9.2 Truth in FOL; 9.3 Semantic Concepts                                                               |
| 10.0   | Relational Reasoning           | 33-35           | 10.1 Using Interpretations; 10.2 Reasoning About Interpretations; 10.3 Properties of Relations                            |
| 11.0   | Quantifier and Identity Proofs | 36-39           | 11.1 Basic Rules for FOL; 11.2 Proofs with Quantifiers; 11.3 Conversion of Quantifiers; 11.4 Rules for Identity           |
| 12.0   | Proof Mastery                  | 40-41, 45-47    | 12.1 Derived Rules; 12.2 Proofs and Semantics; 12.3 Normal Forms; 12.4 Functional Completeness; 12.5 Proving Equivalences |

Every module also includes its own `.8` review and `.9` checkpoint. Chapters
42-44 (modal logic) and chapter 48 (soundness) remain clearly labelled optional
follow-on material; they are not completion requirements for this course.

## Lesson Contract

Every chapter-derived lesson must contain all of the following:

1. An original embedded explanation introducing the learner job and precise
   vocabulary.
2. A source link identifying the mapped textbook chapter.
3. One worked example that exposes the intermediate reasoning steps.
4. One guided practice item with feedback that addresses a named common
   mistake.
5. One independent check tied to an observable objective.
6. One or more retrieval prompts included in the module deck or quiz.
7. A continuation into the next authored curriculum entry, review, or
   checkpoint.

Every curriculum node must reference only existing concept IDs, objective IDs,
item IDs, StudySet IDs, and resource IDs. Stable semantic IDs use kebab case;
display numbering may change only if the source curriculum changes.

## Practice and Assessment

The course does not turn all logic into flashcards. It uses the following
activity allocation:

- Flashcards for vocabulary, notation, and rule recognition.
- Single-choice and multiple-choice checks for truth-functional evaluation,
  rule selection, and misconception diagnosis.
- Short deterministic recall for symbolization and truth-table results where an
  exact or finite answer is fair.
- Manual-completion readings for explanations and worked examples.
- Manual proof submissions with reviewed solution blocks and an explicit
  learner self-check rubric when a proof has multiple valid derivations.
- Transfer tasks that ask learners to model or diagnose an argument outside the
  textbook's immediate examples.

The first pack release does not claim automatic correctness for an arbitrary
free-text proof. Proof learning is assessed through deterministic proof-step
activities, diagnosis activities, and transparent solution-backed manual work.
A future proof-checking capability can replace selected manual tasks without
changing the course's concepts, objectives, source coverage, or node IDs.

## Pack Representation and Runtime Flow

The course is authored as canonical learning-pack documents:

```text
forall x: Calgary source map
  -> source intake and attribution record
  -> catalog.json concepts and observable objectives
  -> courses.json numbered curriculum tree
  -> resources.json source references and original teaching resources
  -> items.json and sets.json practice
  -> shared contract and SDK validation
  -> installed pack
  -> Learnt course/resource/practice projections
  -> local learner evidence and resource engagement
```

`courses.json` uses module nodes titled with `.0` and lesson nodes titled with
the appropriate minor number. `CurriculumNode.entries` preserves the authored
order of embedded resource, worked example, practice item, and checkpoint set.
The existing learning-resource and PracticePlan flows render the course and
persist learner engagement; no subject-specific UI, browser-storage, or desktop
filesystem behavior is introduced.

`resources.json` supplies a bibliographic reference for the source text and
original embedded resources for the learner-facing explanations. Resources link
to the relevant concepts, objectives, and lesson nodes. External source links
remain ordinary safe links; the pack does not execute source HTML, scripts,
styles, or iframe markup.

## Content Failure Rules

- A missing curriculum reference, invalid manifest hash, malformed document, or
  shared-contract validation error blocks installation.
- A numbered lesson without source coverage, an original-content designation,
  or required attribution blocks release during the source-coverage audit.
- A lesson with a valid source record but a broken external textbook URL remains
  usable through its embedded Concourse explanation; the resource shows its
  canonical citation rather than silently substituting an unrelated source.
- A revised teaching resource increments its `contentRevision`; existing
  engagement becomes stale according to the existing resource-engagement
  runtime, while historical learner evidence remains intact.
- A new pack release retains stable `packId`, concept IDs, objective IDs, node
  IDs, and item IDs when the learning meaning is unchanged. Meaningful item
  changes increment `learningRevision`.

## Acceptance Criteria

The Logic Foundations release is ready only when all of the following are true:

- The course displays the twelve modules and sixty-eight numbered lessons in
  authored order.
- Every core lesson has the defined teaching, worked-example, guided-practice,
  independent-check, retrieval, and source-coverage elements.
- A learner can open a lesson, complete its checkpoint practice, reload the
  application, and see the same installed course and locally stored progress.
- Every learning item references at least one valid concept and observable
  objective; every objective is taught and assessed.
- The README and `resources.json` give correct _forall x: Calgary_ CC BY 4.0
  attribution and chapter coverage.
- Pack manifests declare every public document with current SHA-256 and byte
  count values.
- The source pack passes the shared contracts and SDK tests, and Learnt imports
  it in a clean application instance.
- `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` pass
  in Learnt after the authored pack is integrated.

## Delivery Boundaries

This specification defines the course product and its pack data. It does not
authorize a bulk merge from another repository, a change to generated design
documents, or a parallel desktop implementation. Content authoring follows the
existing modular-monolith boundaries: pack documents remain canonical; Learnt
projects them through its shared application and UI paths.
