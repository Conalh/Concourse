# Subject Authoring

Subject packages start as plain data. The SDK turns that data into a trusted
definition.

```text
plain subject data
  -> defineSubject
  -> shape validation
  -> package-integrity validation
  -> immutable DefinedSubject
  -> SubjectAdapter
  -> SubjectRegistry
```

## Compact Example

```ts
import { createSubjectAdapter, defineSubject } from './subject-sdk'

const subject = defineSubject({
  schemaVersion: '0.1',
  id: 'example-subject',
  version: '0.1.0',
  title: 'Example Subject',
  summary: 'A small example subject.',
  tags: ['example'],
  modules: [],
  concepts: [],
  objectives: [],
  activities: [],
  extensions: [],
})

export const exampleSubjectAdapter = createSubjectAdapter(subject)
```

The real subject data must include complete modules, concepts, objectives, and
activities. Empty arrays are shown only to illustrate the object shape.

## Shape Versus Integrity

Shape validation is handled by the core Zod schemas. It checks whether each
object has the expected fields and local invariants.

Package-integrity validation is handled by `defineSubject`. It checks facts that
require the complete package:

- module concept, objective, and activity references exist
- concept prerequisite and related references exist
- objective concept references exist
- activity module, concept, objective, and next-activity references exist
- module order values are unique
- IDs are unique within their own entity collection
- each activity belongs to exactly one authoritative module
- prerequisite graphs are acyclic
- explicit next-activity graphs are acyclic
- choice-evaluation answer IDs exist in authored options
- extension blocks and extension evaluations are declared in the manifest

## Module And Activity Ownership

An activity declares one module through `activity.moduleId`. The declared module
must list that activity in `module.activityIds`.

An activity must not be listed by multiple modules. Concepts and objectives do
not have this restriction; they may appear in multiple module contexts.

## Graph Rules

Concept prerequisite edges use `concept -> prerequisiteConceptIds` and must not
cycle.

Activity sequence edges use `activity -> nextActivityIds` and must not cycle in
v0.1. Branching, merging, cross-module transitions, and terminal activities are
allowed.

## Extensions

Subject packages declare extension envelopes in `subject.extensions`.

Renderer extension blocks must have a matching manifest entry with
`kind: 'renderer'`. Extension evaluations must have a matching manifest entry
with `kind: 'evaluator'`.

This increment validates declarations only. It does not provide renderer or
evaluator implementations.

## Immutability

Accepted subject packages are deeply frozen and returned as `DefinedSubject`.
The caller's raw input object is not frozen or mutated.

## Registry Behavior

`SubjectRegistry` stores subject adapters, preserves registration order, and
rejects duplicate subject IDs. Duplicate registration reports both the existing
and incoming subject versions.

## Production Subject Structure

Production subjects live under `src/subjects/<subject-id>/` and export a
defined subject plus its adapter:

```ts
export const logicBasicsSubject = defineSubject({ ... })
export const logicBasicsSubjectAdapter =
  createSubjectAdapter(logicBasicsSubject)
```

The top-level production export keeps registration explicit:

```ts
export const productionSubjectAdapters = Object.freeze([
  logicBasicsSubjectAdapter,
  movementPlanesSubjectAdapter,
  machineLearningFoundationsSubjectAdapter,
] as const)
```

No runtime package discovery or filesystem scanning is used.

## Production Checklist

A production subject should:

- enter through `defineSubject`
- be wrapped in a `SubjectAdapter`
- use `schemaVersion: "0.1"` and package version `0.1.0`
- use stable kebab-case IDs
- define ordered modules with explicit `activityIds`
- define observable objectives
- use acyclic concept prerequisites and activity sequencing
- include terminal activities and explicit branch edges where authored
- use generic content blocks and deterministic or intentionally ungraded
  evaluations
- contain no learner state, React code, browser code, or infrastructure imports

## Production Subject Catalog

The current production catalog is registered in this order:

1. Logic Basics
2. Movement Planes
3. Machine Learning Foundations

Branches are authored with `nextActivityIds`. The engine and application never
silently choose among multiple branch options.

Rubric-assisted and extension-style work can be recorded as ungraded evidence
when deterministic grading would overclaim.
