# Concourse Activity Micro-Lessons Design

**Status:** Approved design

**Date:** 2026-07-17

## Decision and precedence

Add a tailored instructional micro-lesson immediately before each of the 13 required activities in **How a bacterium survives**.

This specification extends `2026-07-16-concourse-living-route-course-design.md`. It does not change the course graph, evidence model, routing rules, persistence boundary, activity answers, pack-editing demo, or dedicated-page layout.

## Problem

The course demonstrates evidence-aware routing well, but the center stage reaches an assessed prompt after only one general chapter sentence. The experience therefore reads more like a well-designed quiz than a short course.

The learner needs a small amount of explicit instruction before applying each idea. That instruction must remain concise enough to preserve the demo's pace and must not turn the course into a textbook or a sequence of extra introduction screens.

## Goals

- Teach one governing idea immediately before every required activity.
- Define important microbiology vocabulary in plain language.
- Use semantic bold emphasis to make key terms easy to scan.
- Make the second and third activities in a chapter build on, rather than repeat, the first activity's explanation.
- Preserve the existing teaching-to-application flow on one screen.
- Keep the typical route within the advertised 15-20 minute range.
- Keep authored content safe, readable, pack-shaped, and framework-free.

## Non-goals

- Adding chapter introduction screens or new **Continue** actions.
- Expanding support or extension activities in this change.
- Changing questions, correct responses, evidence classifications, or route behavior.
- Adding Markdown, an HTML sanitizer, or a general rich-text system.
- Providing comprehensive microbiology instruction.
- Giving treatment advice or turning the antibiotic scenario into clinical guidance.

## Content scope

Exactly 13 micro-lessons are required: one for each required activity in the six-chapter spine.

Each micro-lesson:

- contains one or two short paragraphs;
- contains 35-55 words total;
- emphasizes one to four vocabulary terms;
- introduces one mechanism or cause-and-effect relationship;
- uses direct language suitable for a beginning biology learner;
- avoids repeating the prompt verbatim;
- teaches the principle needed to reason, without stating the selected answer;
- remains scientifically qualified where bacterial mechanisms vary.

The delayed retrieval activity receives a micro-lesson about connecting disrupted systems and using **retrieval practice**. It must not restate the earlier answer selected for retrieval.

## Instructional sequence

The 13 lessons cover the following ideas in order:

1. **Selective permeability:** small nonpolar molecules cross the lipid core more readily than charged or large polar substances.
2. **Cell envelope roles:** the **cell membrane** controls passage while the **cell wall** provides mechanical support.
3. **Concentration gradient:** net diffusion proceeds from higher concentration toward lower concentration.
4. **Transport proteins:** **channels** provide paths and **carriers** bind selected substances and change shape.
5. **Osmosis:** water moves both ways, but its net movement responds to relative solute concentration.
6. **Osmotic stress:** water loss reduces cell volume; water entry raises pressure that the wall helps resist.
7. **Passive transport** and **energy coupling:** direction relative to a gradient determines whether another energy source is needed.
8. **Active transport:** accumulating a substance against its gradient requires coupling to usable energy.
9. **Gene expression:** information flows through the instructional model DNA -> RNA -> protein.
10. **Ribosome:** a ribosome reads RNA while assembling a protein; it does not store the gene.
11. **Antibiotic targets:** disrupting the wall, membrane, or ribosome affects different cellular processes.
12. **Translation:** a ribosome-targeting mechanism prevents normal production of a needed new protein.
13. **Systems reasoning** and **retrieval practice:** a disrupted process can produce downstream consequences that must be explained with an earlier mechanism.

## Authored data contract

Each required activity receives a `teaching` field in `demo-course-data.json`. The field is structured text rather than Markdown or HTML:

```json
{
  "teaching": [
    {
      "segments": [
        { "kind": "text", "text": "The " },
        { "kind": "term", "text": "cell membrane" },
        {
          "kind": "text",
          "text": " is selectively permeable: some substances cross its lipid core more readily than others."
        }
      ]
    }
  ]
}
```

Contract rules:

- `teaching` contains one or two paragraph objects.
- Every paragraph contains a non-empty `segments` array.
- Segment `kind` is either `text` or `term`.
- Segment text is non-empty and contains no HTML tags or Markdown emphasis markers.
- A `term` segment renders as semantic `<strong>` text.
- Concatenating segments in order produces normal sentence spacing and punctuation.
- Required activities must satisfy the contract; optional activities do not receive placeholder lessons.

This representation keeps emphasis explicit, makes unsafe HTML unnecessary, and allows the pack inspector to show exactly what the browser renders.

## Rendering and layout

For required activities, the current general chapter-model paragraph is replaced by an activity-specific teaching block. Support and extension activities retain their existing contextual chapter copy.

The center-stage order is:

1. chapter eyebrow and chapter title;
2. compact **Key idea** teaching block;
3. delayed-retrieval context when applicable;
4. activity prompt and controls;
5. validation or attempt feedback.

The teaching block uses a semantic section with an accessible **Key idea** heading. It has a restrained left rule or top rule, existing design-system colors, and no decorative card treatment, icon, animation, disclosure, or interaction.

Paragraph width remains aligned with the activity reading column. On narrow screens the block stays in normal document flow and must not introduce horizontal scrolling. Bold terms use the existing typeface and color contrast rather than a separate badge style.

## Safety and accessibility

- Rendering creates text nodes and `<strong>` elements directly; it never uses `innerHTML`.
- Emphasis is semantic and does not rely on color alone.
- The **Key idea** heading follows the existing `h2` chapter heading without skipping hierarchy.
- The block introduces no focus target and does not alter transition focus behavior.
- Screen readers encounter the explanation before the related fieldset or controls.
- No teaching content is hidden behind hover, motion, tabs, or disclosure.
- Existing reduced-motion, zoom, narrow-screen, and no-horizontal-overflow requirements remain in force.

## Scientific and editorial rules

- Prefer a concrete mechanism over a glossary-style definition.
- Define a term in the sentence where it first matters.
- Bold only the vocabulary phrase, never an entire sentence.
- Use "net movement" for diffusion and osmosis.
- Distinguish membrane selectivity from wall support.
- Do not imply that all active transport directly consumes ATP.
- Present DNA -> RNA -> protein as a useful instructional model, not complete gene regulation.
- Describe simplified antibiotic targets as mechanisms, not treatment recommendations.
- Avoid rhetorical filler, encouragement copy, and product marketing inside lessons.

## No-JavaScript experience

The existing no-JavaScript course already provides six concise conceptual explanations and representative reasoning. It remains the static fallback. This change does not duplicate all 13 interactive micro-lessons into the document because doing so would repeat the same required spine at greater length.

The static fallback must continue to expose the same core vocabulary and scientific mechanisms. This change will add semantic `<strong>` emphasis to its six existing chapter explanations where those terms match the interactive lessons.

## Testing strategy

### Content contract

- all 13 required activities contain `teaching`;
- support and extension activities are not required to contain it;
- every lesson contains one or two paragraphs;
- each paragraph contains only `text` and `term` segments;
- concatenated lesson copy contains 35-55 words;
- each lesson contains one to four `term` segments;
- segment text contains no HTML tags or Markdown emphasis;
- every lesson is unique.

### Rendering

- required activities render a **Key idea** section before the activity form;
- `term` segments render as `<strong>` and text segments render as text;
- authored tag-like strings remain inert text;
- support and extension activities continue to render their existing contextual copy;
- the delayed-retrieval lesson does not expose its selected answer.

### Styling and browser verification

- teaching copy remains readable at 320, 390, 768, 1024, and 1440 CSS pixels;
- the block does not widen the stage or page;
- heading order and screen-reader reading order remain correct;
- the first activity, a middle activity, and delayed retrieval are inspected in a real browser;
- console and network remain clean on the canonical production origin.

## Success criteria

- A learner receives explicit instruction before each of the 13 required questions.
- Each lesson is brief enough to scan without interrupting course momentum.
- Important vocabulary is visibly and semantically emphasized.
- Later lessons build on earlier ones instead of repeating chapter boilerplate.
- The activity remains an application of the lesson rather than an answer copied from it.
- Route, evidence, storage, pack editing, timing, and responsive behavior remain unchanged.
- Automated verification, real-browser verification, CI, deployment, and canonical live checks pass before completion is claimed.
