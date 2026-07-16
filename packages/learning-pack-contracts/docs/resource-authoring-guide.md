# Resource Authoring Guide

This guide describes how to author `LearningResource` records for Learning
Pack Contract v0.1. Resource support is optional: a pack that only contains
practice items can omit `resources.json`.

## When To Use A LearningResource

Use `LearningResource` for teaching material that helps a learner understand,
review, or remediate a concept before or after playing `LearningItem` content.

Good resource examples:

- A short pack-authored reading.
- A worked example.
- A curated article URL.
- A video locator with timestamped segments.
- An audio episode locator.
- A textbook chapter citation.
- A link to an external interactive demonstration.
- A learner-downloadable notebook, script, small dataset, or environment file.

Do not use resources for learner progress, app settings, scheduling state,
CSS, HTML pages, JavaScript, React components, plugins, or executable graders.

## Minimal Embedded Resource

```json
{
  "id": "resource-truth-values-reading",
  "contentRevision": 1,
  "title": "Truth Values Reading",
  "summary": "A short explanation of true and false propositions.",
  "modality": "text",
  "roles": ["introduction", "explanation"],
  "conceptIds": ["concept-truth-values"],
  "objectiveIds": ["objective-recognize-truth-values"],
  "estimatedDurationSeconds": 180,
  "difficulty": "introductory",
  "language": "en-US",
  "source": {
    "kind": "embedded-content",
    "content": [
      {
        "blockId": "block-truth-values-intro",
        "kind": "text",
        "text": "A proposition is a statement that can be evaluated as true or false.",
        "language": null,
        "calloutRole": null,
        "assetId": null,
        "altText": null
      }
    ]
  },
  "tags": ["reading"],
  "provenance": {
    "author": "Learnt",
    "license": "CC-BY-4.0",
    "attributionText": "Truth Values Reading by Learnt.",
    "contentOwnership": "pack-authored"
  }
}
```

## Choosing Source Variants

| Source kind | Use when |
| --- | --- |
| `embedded-content` | The pack carries safe authored content blocks. |
| `external-link` | The resource is an external article or web page. |
| `external-video` | The resource is a video from a known provider. |
| `external-audio` | The resource is an audio episode or clip. |
| `bibliographic-reference` | The resource is a book, chapter, paper, DOI, ISBN, or page range. |
| `interactive-reference` | The resource is an external interactive tool or sandbox. |
| `pack-asset` | The pack carries a validated lab file for explicit learner download. |

Use HTTPS URLs for all external locators. Do not embed HTML, CSS, JavaScript,
iframes, or executable snippets.

## Pack Asset Resources

`pack-asset` is a delivery reference, not an embedded renderer or execution
request. Packs using it must require `learning-resource.pack-asset@1`.

```json
{
  "id": "resource-module-01-notebook",
  "contentRevision": 1,
  "title": "Module 1 learner notebook",
  "modality": "interactive",
  "roles": ["worked-example"],
  "source": {
    "kind": "pack-asset",
    "assetId": "module-01-notebook",
    "suggestedFileName": "module-01-lab.ipynb",
    "mediaType": "application/x-ipynb+json"
  }
}
```

The referenced manifest entry must use role `asset`, carry the same media type,
and contain the canonical hash and byte count. The version-1 allowlist is:

| Filename extension | Media type |
| --- | --- |
| `.ipynb` | `application/x-ipynb+json` |
| `.py` | `text/x-python` |
| `.csv` | `text/csv` |
| `.md` | `text/markdown` |
| `.txt` | `text/plain` |
| `.yml` or `.yaml` | `application/yaml` |

The suggested filename must be a safe basename of 1 to 128 characters after
trimming. Do not use paths, `/`, `\\`, control characters, `.` or `..`, or a
name ending in a dot or space. The extension is case-insensitive but must match
the media type. Keep files at or below 10 MiB for portable desktop delivery.

Concourse does not execute or preview a pack asset. A successful validation
proves integrity and contract compatibility, not that the code is benevolent.
Learners should inspect files from third-party courses before running them.

## IDs And Revisions

Resource IDs use the same local ID rules as other pack entities:

- Stable lowercase IDs such as `resource-negation-video`.
- No whitespace, `:`, `..`, leading `/`, or trailing `/`.
- Do not derive IDs from array positions.

`contentRevision` starts at `1`. Increment it when prior completion may no
longer be educationally valid:

- The explanation meaning changed.
- A correction fixes a substantive teaching error.
- The target concepts/objectives changed materially.
- Segments moved enough that old segment completion is stale.
- A resource was replaced by materially different content under the same ID.

Do not increment `contentRevision` for spelling fixes, title-only edits,
tag-only changes, provenance corrections, or minor wording that does not change
meaning.

## Segments

Use segments when a resource has meaningful teachable subparts. Segment IDs are
scoped to the resource.

```json
{
  "id": "segment-negation-example",
  "title": "Worked NOT example",
  "startSeconds": 91,
  "endSeconds": 180,
  "conceptIds": ["concept-truth-values"],
  "objectiveIds": ["objective-evaluate-negation"],
  "checkpointStudySetIds": ["set-core-quiz"],
  "tags": ["worked-example"]
}
```

For embedded resources, segments may use `contentBlockStartId` and
`contentBlockEndId`. Add `blockId` to the referenced content blocks.

## Checkpoints

Resource-level `checkpointStudySetIds` point to StudySets that make sense
after the whole resource. Segment-level `checkpointStudySetIds` point to
StudySets that make sense after a segment.

Checkpoint StudySets should be ordinary v0.1 `StudySet` records. They must not
depend on learner progress in the pack itself.

## Resource Links

Add resource links where learners or apps need context:

- `Concept.resourceLinks` for concept-level explanations or references.
- `Objective.resourceLinks` for objective-specific teaching.
- `LearningItem.supportResourceLinks` for remediation before or after a
  practice attempt.
- `CurriculumNode.entries` for ordered teaching and practice flow.

Example item remediation link:

```json
{
  "resourceId": "resource-negation-video",
  "segmentId": "segment-negation-example",
  "role": "worked-example",
  "recommendedUse": "after-incorrect",
  "priority": 1
}
```

## Ordered Curriculum Entries

Use `CurriculumNode.entries` when the authored order mixes resources, items,
StudySets, and child nodes:

```json
[
  { "kind": "resource", "resourceId": "resource-truth-values-reading" },
  { "kind": "item", "itemId": "item-truth-values-flashcard" },
  {
    "kind": "resource",
    "resourceId": "resource-negation-video",
    "segmentId": "segment-negation-example"
  },
  { "kind": "study-set", "studySetId": "set-core-quiz" }
]
```

Keep `children` and `itemIds` populated for compatibility with simpler app
projections. `entries` is the richer sequence for apps that support
`curriculum.ordered-resource-entries@1`.

## Provenance And Accessibility

Always fill provenance when redistributing or referencing third-party material:

- Use `contentOwnership: "pack-authored"` only for content authored for the
  pack.
- Use `external-link-only` for external links, videos, audio, bibliographic
  references, and interactive references that the pack does not redistribute.
- Include `license`, `licenseUrl`, and `attributionText` when the license
  requires attribution.
- Use `lastReviewedAt` when a curator has checked the link or citation.

Accessibility metadata is optional but useful:

- `captionsAvailable`
- `transcriptAvailable`
- `audioDescriptionAvailable`
- `screenReaderOptimized`
- `textAlternativeAvailable`
- `language`
- `accessibilityNotes`

## Migrations

When a resource changes across pack releases, add migration hints:

```json
{
  "entityKind": "resource",
  "fromId": "resource-truth-values-reading",
  "toId": "resource-truth-values-reading",
  "changeKind": "revised",
  "fromLearningRevision": null,
  "toLearningRevision": null,
  "fromContentRevision": 1,
  "toContentRevision": 2,
  "progressPolicy": "manual-review",
  "engagementPolicy": "preserve-history-reset-completion",
  "rationale": "The explanation was corrected; old reading history is retained but completion should be refreshed."
}
```

Applications keep historical engagement events. Migration metadata only guides
derived completion or "needs reread" views.

## Validation Checklist

- `resources.json` is listed in `pack.json.files` when present.
- Every resource ID is stable and unique in the pack.
- Every referenced concept, objective, StudySet, item, resource, segment, and
  asset exists.
- Segment end time is greater than segment start time.
- Embedded segment block IDs exist in the embedded source content.
- External URLs use HTTPS.
- Every pack asset uses the exact version-1 media type/extension pair, a safe
  basename, and a manifest entry whose `assetId`, role, and media type match.
- Required capabilities are supported by target apps.
- Provenance matches the source kind and ownership.
- No learner progress or engagement events are embedded in the pack archive.
