# Flashcard Pack Language

Flashcard packs are Markdown files that the app can import with the
`Import Pack MD` button. Use this format when asking an LLM to generate a deck.

## Required Shape

```md
# Flashcard Pack: LLM Foundations
> Flashcard Pack v1

Pack: LLM Foundations
Description: Core vocabulary for understanding LLM systems.
Default Concept: AI Vocabulary
Default Tags: ai, llm

## Card: Token
Definition: A unit of text processed by a model, often a word piece, symbol, or punctuation mark.
Concept: Model Inputs
Tags: text units, context
Related: Embedding

## Card: Embedding
Definition: A numeric representation that captures semantic meaning so related items sit near each other in vector space.
Concept: Representations
Tags: vectors, retrieval, semantic meaning
Related: Token
```

## Fields

- `Pack`: pack name shown in import feedback.
- `Description`: optional pack summary.
- `Default Concept`: concept used by cards that omit `Concept`.
- `Default Tags`: comma-separated tags added to every card.
- `## Card: Term`: starts a new card and sets the term.
- `Definition`: required. Keep it concise and testable.
- `Concept`: optional concept grouping for stats and adaptive review.
- `Tags`: optional comma-separated card-specific tags.
- `Related`: optional comma-separated terms from the same pack. These become concept-graph links.

## Generation Prompt

```text
Create a Flashcard Pack v1 Markdown file for the topic: <topic>.

Rules:
- Output only Markdown.
- Use the exact pack language from FLASHCARD_PACKS.md.
- Include Pack, Description, Default Concept, and Default Tags.
- Create 10-20 cards.
- Each card must use "## Card: <term>".
- Each card must include Definition, Concept, Tags, and Related.
- Definitions should be one sentence, concrete, and easy to quiz.
- Related must use terms from the same pack.
- Do not include explanations outside the pack file.
```
