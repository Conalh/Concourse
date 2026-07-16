# Flashiet Learning Pack Integration Inventory

Date: 2026-06-23

Repo root inspected: `C:\Projects\Learning\Flashiet`

This inventory is specific to the Flashiet/Synapse implementation in this repo.
It replaces the earlier FlashCards app inventory assumptions where the model was
spread across `src/utils/learning.js`, `src/utils/conceptGraph.js`, and quiz
helpers. In Flashiet, the main model is centralized in
`src/lib/synapseModel.js`.

This document does not define a new portable schema. The portable schema should
be owned by the shared package.

## Source Material Status

Requested source docs are not present in this checkout:

- `docs/learning-packs/source/FLASHCARD_PACKS.md`
- `docs/learning-packs/source/flashcards-quizzes-and-packs.md`

Available source document:

- `FLASHCARD_PACKS.md`

The available source doc describes the current Markdown pack language but is
shorter than the richer OneDrive FlashCards copy. It documents `Pack`,
`Description`, `Default Concept`, `Default Tags`, `## Card: Term`,
`Definition`, `Concept`, `Tags`, and `Related`.

## Existing Test Coverage

No test files were found in this tree.

- `package.json` only defines `dev`, `build`, and `preview`.
- No `*test*` or `*spec*` files were found outside `node_modules` and `dist`.
- No Vitest, Jest, Testing Library, Playwright, or assertion usage was found in
  app source.

Every required area below therefore lists `Existing test files: none found`.

## Current Data Boundaries

### Portable Authored Content

Current portable authored card content is already mostly separate from learner
progress. The normalized Flashiet card shape is produced by
`normalizeSynapseCard()` in `src/lib/synapseModel.js`:

```js
{
  id,
  term,
  topic,
  def,
  short,
  tags,
  related
}
```

Portable authored sources:

- `src/data/synapseCards.js`
- Manual add form in `src/components/LibraryScreen.jsx`
- Markdown import via `src/utils/cardPacks.js`
- JSON import via `src/utils/cardPacks.js`
- JSON export via `exportDeck()` in `src/lib/synapseModel.js`

Mapping notes:

- Imported `definition` normalizes into `def`.
- Imported `concept` normalizes into `topic`.
- `short` is authored when present, otherwise derived from the definition.
- `related` is stored and exported, but not currently used by quiz generation
  or a graph.

### Private Learner Progress

Private learner progress is stored under `persistent.progress` in the
`synapse_v2` localStorage object:

```js
progress: {
  [cardId]: {
    strength,
    seen,
    correct,
    wrong,
    last
  }
}
```

Other private/app-local persistent fields:

- `streak`
- `bestStreak`
- `lastDate`
- `totalA`
- `totalC`
- `history`
- `theme`
- `sound`

This is a major difference from the earlier FlashCards app: learner progress is
not embedded on each card in the main normalized card model.

### Application Presentation

Application presentation is app-owned and should not be treated as portable
authored content:

- Theme IDs in `THEME_ORDER`: `dark`, `pastel`, `mono`
- Theme labels in `THEME_LABELS`: `Ink`, `Calm`, `Mono`
- CSS variables in `src/styles/base-shell.css`
- `persistent.theme`, set on `document.documentElement.dataset.theme` and on
  `.synapse-shell-bg[data-theme=...]`
- Screen state in `src/App.jsx`: `screen`, `flash`, `quiz`, `focus`, `counts`
- UI components under `src/screens/*` and `src/components/*`
- Sound and vibration feedback behavior in `src/App.jsx`

### Generated Or Derived State

Generated or derived state includes:

- Seed progress from `createSeedProgress()`
- `short` when derived by `summarizeDefinition()`
- Metrics derived in `src/App.jsx`, including topic stats, weak concepts,
  weak topics, mastered count, accuracy, daily ring percentage, and weak count
- Flash queues from `pickWeakestQueue()`
- Focus queues from `pickWeakestQueue()`
- Quiz queues and answer choices from `buildQuizQueue()`
- Topic stats from `getTopicStats()`
- Sparkline points from `buildSparklinePoints()`
- Strength labels and colors from `confidenceLabel()` and `strengthColor()`

No concept graph is currently built. `related` links are normalized, merged, and
exported, but not consumed by a graph or quiz distractor algorithm.

## Inventory By Required Area

### 1. Current Card Content Type

Primary files:

- `src/lib/synapseModel.js`
- `src/data/synapseCards.js`
- `src/components/LibraryScreen.jsx`

Exported symbols:

- `SEED_CARDS` from `src/data/synapseCards.js`
- `SEED_STRENGTHS` from `src/data/synapseCards.js`
- `normalizeSynapseCards()` from `src/lib/synapseModel.js`
- `mergeSynapseCards()` from `src/lib/synapseModel.js`
- `exportDeck()` from `src/lib/synapseModel.js`
- `LibraryScreen` default export from `src/components/LibraryScreen.jsx`

Private symbols shaping the card type:

- `normalizeSynapseCard()`
- `summarizeDefinition()`
- `normalizeList()`
- `slugify()`

Current normalized card shape:

```js
{
  id: string,
  term: string,
  topic: string,
  def: string,
  short: string,
  tags: string[],
  related: string[]
}
```

Input aliases accepted by normalization:

- `id` or generated from `term`
- `def` or `definition`
- `topic` or `concept`
- `short` or derived summary from definition
- `tags` as array or comma-separated string
- `related` as array or comma-separated string

Manual card creation in `LibraryScreen` captures:

- `term`
- `definition`
- `concept`

Manual creation does not capture tags, related links, pack metadata,
`packId`, `itemId`, or revision fields.

Storage keys:

- `synapse_v2`
- Legacy read path: `synapse_v1`

Existing test files: none found.

### 2. Learner Progress And Card Statistics

Primary files:

- `src/lib/synapseModel.js`
- `src/App.jsx`
- `src/screens/HomeScreen.jsx`
- `src/screens/FlashcardsScreen.jsx`
- `src/screens/FocusScreen.jsx`
- `src/screens/ProgressScreen.jsx`
- `src/screens/QuizScreen.jsx`
- `src/screens/SettingsScreen.jsx`

Exported symbols:

- `createProgressForCards()`
- `ensureProgressForCards()`
- `getStrength()`
- `pickWeakestQueue()`
- `getTopicStats()`
- `buildSparklinePoints()`
- `confidenceLabel()`
- `strengthColor()`
- `GOAL`
- `QUIZ_LENGTH`
- `FLASH_LENGTH`
- `FOCUS_LENGTH`
- `BLITZ_SECONDS`

Private progress writers in `src/App.jsx`:

- `recordAnswer(cardId, ok)`
- `recordSession(accuracy)`

Current per-card progress shape:

```js
{
  strength,
  seen,
  correct,
  wrong,
  last
}
```

Current persistent state shape:

```js
{
  progress,
  streak,
  bestStreak,
  lastDate,
  totalA,
  totalC,
  history,
  theme,
  sound
}
```

Progress behavior:

- `recordAnswer()` adjusts `strength` by `+16` for correct answers and `-20`
  for wrong answers, clamped to `0..100`.
- `recordAnswer()` increments `seen`, `correct`, `wrong`, `last`, `totalA`,
  and `totalC`.
- `recordSession()` updates streaks and appends session accuracy to `history`,
  capped to 12 values by `normalizePersistentState()` and update logic.
- `ensureProgressForCards()` guarantees progress entries exist for all current
  cards.
- `createProgressForCards()` creates zeroed progress for replacement decks.

Storage keys:

- `synapse_v2`
- Legacy read path: `synapse_v1`

Existing test files: none found.

### 3. Markdown Pack Parsing

Primary file:

- `src/utils/cardPacks.js`

Exported symbols:

- `PACK_TEMPLATE`
- `parseCardPackMarkdown()`

Private parser helpers:

- `readMetadataLine()`
- `applyCardField()`
- `finalizeCards()`
- `parseFieldLine()`
- `parseTitle()`
- `parseTitleFromCards()`
- `parseList()`
- `mergeLists()`
- `cleanValue()`
- `normalizeLookup()`
- `slugify()`

Supported metadata aliases in `FIELD_ALIASES`:

- `pack`
- `title`
- `description`
- `version`
- `default concept`
- `default tags`

Supported card field aliases:

- `id`
- `term`
- `definition`
- `concept`
- `tags`
- `tag`
- `related`
- `links`

Parser behavior:

- Converts CRLF/CR line endings to LF.
- Starts cards with `## Card: <term>`.
- Reads metadata before the first card.
- Drops cards missing `term` or `definition`.
- Throws only when zero valid cards remain.
- Uses `Version` metadata when present; otherwise reports version `1`.
- Applies `Default Concept` and `Default Tags`.
- Generates missing IDs as `<pack slug>-<term slug>`.
- Resolves `Related` values against terms and IDs from the same imported pack.
- Slugifies unresolved related values instead of reporting an unresolved-link
  warning.

Storage keys: none directly.

Existing test files: none found.

### 4. JSON Import And Export

Primary files:

- `src/lib/synapseModel.js`
- `src/utils/cardPacks.js`
- `src/components/LibraryScreen.jsx`
- `src/App.jsx`

Exported symbols:

- `parseDeckJson()` from `src/utils/cardPacks.js`
- `downloadTextFile()` from `src/utils/cardPacks.js`
- `exportDeck()` from `src/lib/synapseModel.js`
- `LibraryScreen` default export from `src/components/LibraryScreen.jsx`

JSON export behavior:

- `LibraryScreen.exportJson()` downloads `synapse-flashcards.json`.
- It serializes `exportDeck(cards)`, not raw app state.
- `exportDeck()` returns:

```js
{
  pack: 'Synapse Deck',
  description: 'Exported from Synapse.',
  cards: [
    {
      id,
      term,
      definition: card.def,
      concept: card.topic,
      tags,
      related
    }
  ]
}
```

Important difference from the earlier FlashCards inventory:

- JSON export does not include `persistent.progress`, `streak`, `history`,
  `theme`, `sound`, or other private learner/app state.

JSON import behavior:

- `parseDeckJson()` accepts either a top-level card array or an object with a
  `cards` array.
- `LibraryScreen.importJson()` calls `onReplaceCards(imported.cards)`.
- `App.replaceCards()` normalizes cards, replaces the whole deck, creates fresh
  progress with `createProgressForCards(nextCards)`, resets `totalA`, `totalC`,
  and `history`, and resets flash/quiz/focus transient state.
- Existing `streak`, `bestStreak`, `lastDate`, `theme`, and `sound` are
  preserved during deck replacement because the function spreads
  `currentStore.persistent`.

Markdown pack import behavior:

- `LibraryScreen.importPack()` calls `onImportCards(imported.cards)`.
- `App.importCards()` normalizes and merges incoming cards into the current
  deck with `mergeSynapseCards()`.
- It then calls `ensureProgressForCards()` so imported cards get progress
  entries without resetting existing progress.

Storage keys:

- `synapse_v2`
- Legacy read path: `synapse_v1`

Existing test files: none found.

### 5. Card Normalization

Primary file:

- `src/lib/synapseModel.js`

Exported symbols:

- `normalizeSynapseCards()`
- `mergeSynapseCards()`
- `createProgressForCards()`
- `ensureProgressForCards()`

Private helpers:

- `normalizeSynapseCard()`
- `summarizeDefinition()`
- `normalizeList()`
- `slugify()`
- `normalizePersistentState()`

Normalization behavior:

- `normalizeSynapseCards()` filters to records with `term` and either `def` or
  `definition`.
- `normalizeSynapseCard()` slugifies `card.id || card.term`.
- `def` accepts `card.def` or `card.definition`.
- `topic` accepts `card.topic` or `card.concept`, defaulting to `General`.
- `short` accepts `card.short` or derives from the first clause of `def`.
- `tags` accepts arrays or comma-separated strings.
- `related` accepts arrays or comma-separated strings.
- Unknown card properties are dropped.
- `mergeSynapseCards()` merges by `card.id`; incoming fields overwrite existing
  authored card fields.

Storage keys:

- `synapse_v2`
- Legacy read path: `synapse_v1`

Existing test files: none found.

### 6. Stable ID Generation

Primary files:

- `src/lib/synapseModel.js`
- `src/utils/cardPacks.js`
- `src/data/synapseCards.js`

Exported symbols:

- `SEED_CARDS`
- `normalizeSynapseCards()`
- `parseCardPackMarkdown()`
- `buildQuizQueue()`

Current ID behavior:

- Seed cards define stable authored IDs in `src/data/synapseCards.js`, such as
  `attention`, `transformer`, `token`, `rag`, and `vecdb`.
- Markdown card IDs are stable when `Id:` is supplied.
- Markdown missing IDs are generated as `<pack slug>-<term slug>` in
  `src/utils/cardPacks.js`.
- `normalizeSynapseCard()` slugifies any incoming `id` or falls back to the
  slugified term.
- `slugify()` in both `src/utils/cardPacks.js` and `src/lib/synapseModel.js`
  lowercases, replaces non-alphanumeric runs with `-`, trims boundary dashes,
  and falls back to `crypto.randomUUID()` if no slug remains.
- Quiz question IDs are card IDs in `buildQuizQueue()`.
- Quiz answer option IDs are the option card IDs.
- There is no separate review event ID today.

Storage keys:

- Card IDs are persisted under `cards` inside `synapse_v2`.
- Progress is keyed by card ID under `persistent.progress`.

Existing test files: none found.

### 7. Import Merge Behavior

Primary files:

- `src/App.jsx`
- `src/lib/synapseModel.js`
- `src/components/LibraryScreen.jsx`
- `src/utils/cardPacks.js`

Exported symbols:

- `parseCardPackMarkdown()`
- `parseDeckJson()`
- `normalizeSynapseCards()`
- `mergeSynapseCards()`
- `ensureProgressForCards()`
- `createProgressForCards()`

Private app functions:

- `importCards(rawCards)`
- `replaceCards(rawCards)`
- `addCard(rawCard)`

Markdown pack import path:

- `LibraryScreen.importPack()` parses Markdown with `parseCardPackMarkdown()`.
- It calls `onImportCards(imported.cards)`.
- `App.importCards()` normalizes imported cards.
- Empty normalized imports return `0`.
- Non-empty imports merge with `mergeSynapseCards()`.
- `mergeSynapseCards()` merges by normalized `card.id`.
- Incoming card fields overwrite existing authored fields for the same ID.
- Existing progress is preserved because progress lives separately and
  `ensureProgressForCards()` keeps current entries.
- Imported pack metadata is not persisted.

JSON replace path:

- `LibraryScreen.importJson()` parses JSON with `parseDeckJson()`.
- It calls `onReplaceCards(imported.cards)`.
- `App.replaceCards()` replaces the whole deck.
- Replacement creates fresh per-card progress and resets totals/history.
- Replacement does not reset theme or sound.

Manual add path:

- `LibraryScreen.submitCard()` calls `onAddCard()`.
- `App.addCard()` normalizes a single raw card and merges it by ID.
- A manual card can overwrite an existing card with the same slugified ID.

Storage keys:

- `synapse_v2`
- Legacy read path: `synapse_v1`

Existing test files: none found.

### 8. Related-Card And Concept Graph Behavior

Primary files:

- `src/lib/synapseModel.js`
- `src/utils/cardPacks.js`
- `src/components/LibraryScreen.jsx`

Exported symbols:

- `normalizeSynapseCards()`
- `mergeSynapseCards()`
- `exportDeck()`
- `parseCardPackMarkdown()`

Current related behavior:

- Markdown `Related` and `Links` parse into `related` IDs.
- `normalizeSynapseCard()` keeps `related` as a normalized list.
- `mergeSynapseCards()` stores incoming `related` values with the card.
- `exportDeck()` includes `related`.

Current graph behavior:

- There is no `conceptGraph` utility in this repo.
- No graph object with nodes, edges, clusters, drift, or confusion pairs is
  currently built.
- Quiz generation does not use `related`.
- Progress and focus selection do not use `related`.
- Topic mastery is grouped by `topic`, not by graph edges.

Migration implication:

- `related` is cleaner than in the earlier FlashCards app because learner
  confusion does not mutate it. It is currently authored/imported data only.
- It is also underused, so introducing a shared concept graph would be new
  behavior.

Storage keys:

- Stored as part of cards inside `synapse_v2`.

Existing test files: none found.

### 9. Quiz Generation From Cards

Primary files:

- `src/lib/synapseModel.js`
- `src/App.jsx`
- `src/screens/QuizScreen.jsx`

Exported symbols:

- `QUIZ_LENGTH`
- `BLITZ_SECONDS`
- `buildQuizQueue()`
- `createEmptyQuizState()`
- `shuffle()`

Private app functions:

- `startQuiz(mode)`
- `answerQuiz(index)`
- `nextQuizQuestion()`

Quiz modes:

- `blitz`
- `steady`

Queue item shape from `buildQuizQueue()`:

```js
{
  id,
  mode,
  def,
  topic,
  opts,
  correctIdx
}
```

Generation behavior:

- `buildQuizQueue()` shuffles card IDs, takes up to `QUIZ_LENGTH`, and creates
  one term-recognition question per selected card.
- The prompt is the card definition (`def`).
- Distractors are three random cards from the deck excluding the target card.
- `correctIdx` is the index of the target card in shuffled options.
- There are no comparison, distinction, explanation, discrimination, or
  related-card modes in the current implementation.
- `answerQuiz()` updates progress through `recordAnswer(question.id, ok)`.
- Blitz mode uses `BLITZ_SECONDS`, a timer, speed bonus, combo, and score.

Storage keys:

- Quiz state is transient React state.
- Quiz answers update `persistent.progress`, `totalA`, and `totalC` inside
  `synapse_v2`.

Existing test files: none found.

### 10. Existing Theme And Visual-Token Behavior

Primary files:

- `src/lib/synapseModel.js`
- `src/App.jsx`
- `src/components/Shell.jsx`
- `src/screens/SettingsScreen.jsx`
- `src/styles.css`
- `src/styles/base-shell.css`
- `src/styles/home.css`
- `src/styles/practice.css`
- `src/styles/quiz-library.css`
- `src/styles/focus-progress-nav.css`
- `src/styles/motion.css`
- `src/styles/responsive.css`

Exported symbols:

- `THEME_ORDER`
- `THEME_LABELS`
- `strengthColor()`
- `confidenceLabel()`

Current theme IDs:

- `dark`
- `pastel`
- `mono`

Theme labels:

- `Ink`
- `Calm`
- `Mono`

Key CSS variables in `src/styles/base-shell.css`:

- `--bg`
- `--bg-2`
- `--surface`
- `--surface-2`
- `--border`
- `--border-strong`
- `--text`
- `--text-dim`
- `--text-faint`
- `--accent`
- `--accent-soft`
- `--accent-ink`
- `--focus`
- `--focus-soft`
- `--success`
- `--success-soft`
- `--error`
- `--error-soft`
- `--warn`
- `--warn-soft`
- `--shell-bg`

Theme behavior:

- `persistent.theme` is validated by `normalizePersistentState()` against
  `THEME_ORDER`.
- `cycleTheme()` advances through `THEME_ORDER`.
- `App` writes `persistent.theme` to `document.documentElement.dataset.theme`.
- The root shell also renders `data-theme={persistent.theme}`.
- CSS theme variants are driven by `.synapse-shell-bg[data-theme="pastel"]`
  and `.synapse-shell-bg[data-theme="mono"]`; the default dark theme is the
  base `.synapse-shell-bg`.
- Theme is app presentation state, not pack metadata.

Storage keys:

- `persistent.theme` inside `synapse_v2`.
- Legacy read path: `synapse_v1`.

Existing test files: none found.

### 11. Persistence And Migration Behavior

Primary files:

- `src/lib/synapseModel.js`
- `src/App.jsx`

Exported symbols:

- `STORAGE_KEY`
- `LEGACY_STORAGE_KEY`
- `loadSynapseStore()`
- `saveSynapseStore()`
- `createSeedStore()`
- `normalizeSynapseCards()`
- `createProgressForCards()`
- `ensureProgressForCards()`

Storage keys:

- Current: `synapse_v2`
- Legacy read path: `synapse_v1`

Current stored shape:

```js
{
  cards,
  persistent: {
    progress,
    streak,
    bestStreak,
    lastDate,
    totalA,
    totalC,
    history,
    theme,
    sound
  }
}
```

Persistence behavior:

- `loadSynapseStore()` reads `synapse_v2`.
- If `synapse_v2` contains `persistent` and a `cards` array, it normalizes both.
- If current load fails or is invalid, it falls through to `loadLegacyStore()`.
- If legacy load fails or is invalid, it creates seeded data with
  `createSeedStore()`.
- `saveSynapseStore()` writes the whole store to `synapse_v2` and silently
  ignores write failures.
- `App` saves on every `store` state change.

Migration behavior:

- `loadLegacyStore()` reads `synapse_v1`.
- It only accepts legacy data with `parsed.progress`.
- It migrates by normalizing `SEED_CARDS` and applying
  `normalizePersistentState(parsed, cards)`.
- There is no explicit schema version inside the stored object.
- Legacy migration does not migrate arbitrary legacy cards; it uses current
  seed cards.

Existing test files: none found.

### 12. Existing Validation And Error-Reporting Mechanisms

Primary files:

- `src/components/LibraryScreen.jsx`
- `src/utils/cardPacks.js`
- `src/lib/synapseModel.js`
- `src/App.jsx`

Exported symbols:

- `parseCardPackMarkdown()`
- `parseDeckJson()`
- `normalizeSynapseCards()`
- `loadSynapseStore()`
- `saveSynapseStore()`

Validation behavior:

- Manual add checks trimmed `term` and `definition`; if either is missing it
  sets `Term and definition are required.` in UI state.
- Manual add does not use HTML `required` attributes.
- `parseCardPackMarkdown()` throws when no valid cards are found.
- `parseDeckJson()` throws when the top-level value is neither an array nor an
  object with a `cards` array.
- JSON parse errors surface through `LibraryScreen` catch blocks.
- `normalizeSynapseCards()` drops cards missing `term` or definition content.
- `normalizePersistentState()` clamps/normalizes persistent state with defaults.
- `loadSynapseStore()` and `saveSynapseStore()` catch errors silently.

Error reporting behavior:

- Import/export/manual-add feedback is string-only through `LibraryScreen`
  `message` state.
- There is no structured validation report.
- There are no error codes, warnings, telemetry events, or persisted import
  diagnostics.
- Unresolved Markdown `Related` values are slugified, not reported.

Storage keys:

- Current persisted data is under `synapse_v2`.
- Legacy read path is `synapse_v1`.

Existing test files: none found.

## Mapping To Target Vocabulary

### LearningPack

Current nearest sources:

- Markdown metadata from `parseCardPackMarkdown()`
- JSON export object from `exportDeck()`
- Local deck stored as `store.cards`

Current fields available:

- `pack` from Markdown/JSON metadata
- `description` from Markdown/JSON metadata
- `version` from Markdown metadata
- `defaultConcept` from Markdown metadata
- `defaultTags` from Markdown metadata

Gaps:

- No persisted `packId`.
- No persisted `packVersion`.
- No pack registry.
- Pack metadata from Markdown import is used only for UI feedback, then lost.
- JSON export hardcodes `pack: 'Synapse Deck'`.

### Subject

Current nearest sources:

- `topic`
- `tags`
- Pack title/description when present during import/export

Gaps:

- No first-class subject entity.
- No stable subject ID.
- No subject hierarchy.

### Course

Current nearest sources:

- The whole local deck.
- A Markdown imported pack before merge.

Gaps:

- No course entity.
- No course ordering.
- No enrollment or completion model.
- Multiple imported packs collapse into one local deck.

### CurriculumNode

Current nearest sources:

- `topic` strings.
- Topic stats from `getTopicStats()`.

Gaps:

- No authored curriculum node ID.
- No parent/child hierarchy.
- No graph or sequence.
- No persisted node metadata.

### Concept

Current nearest sources:

- `card.topic`.
- `card.term` when each card is treated as one concept.
- `related` as dormant concept adjacency metadata.

Gaps:

- No stable concept entity separate from card.
- `topic` is a display/grouping string.
- `related` is not used to build a concept graph.

### Objective

Current nearest sources:

- None as authored data.
- Quiz mode implicitly asks "Which term matches this definition?"

Gaps:

- No objective field.
- No objective ID.
- No objective-to-item mapping.
- No mastery criteria per objective.

### LearningItem

Current nearest source:

- Normalized card from `normalizeSynapseCard()`.

Mapping:

- `LearningItem.itemId` maps to current `card.id`.
- Front/prompt content maps to `card.term`.
- Back/answer content maps to `card.def`.
- Concept/topic grouping maps to `card.topic`.
- Short label/summary maps to `card.short`.
- Tags map to `card.tags`.
- Related item references map to `card.related`.

Gaps:

- No `packId`.
- No `packVersion`.
- No `learningRevision`.
- `id` is both local item ID and progress key.

### StudySet

Current nearest sources:

- Full `cards` array.
- Flash queue from `pickWeakestQueue(cards, progress, FLASH_LENGTH)`.
- Focus queue from `pickWeakestQueue(cards, progress, FOCUS_LENGTH)`.
- Quiz queue from `buildQuizQueue(cards, mode)`.

Gaps:

- No persisted study set entity.
- Study sets are transient queues.
- Queue membership is derived from private progress or random selection.

### ThemeMetadata

Current nearest sources:

- `THEME_ORDER`.
- `THEME_LABELS`.
- CSS variables in `src/styles/base-shell.css`.
- `persistent.theme`.

Gaps:

- No pack-level theme metadata.
- No imported/exported theme metadata.
- No pack theme validator.
- Theme is user/app preference, not authored content.

### ReviewEvent

Current nearest sources:

- `recordAnswer(cardId, ok)` updates aggregated progress.
- `recordSession(accuracy)` appends aggregated session accuracy to `history`.

Current available event-like data:

- Per-card progress has `last`, `seen`, `correct`, and `wrong`.
- Session `history` stores recent session accuracy percentages.

Gaps:

- No review event ledger.
- No event ID.
- No timestamped per-answer history beyond per-card `last`.
- No question type on progress.
- No `packId`, `packVersion`, `itemId`, or `learningRevision`.

## Impact Of Adding `packId`, `packVersion`, `itemId`, And `learningRevision`

### `src/lib/synapseModel.js`

Affected exported symbols:

- `loadSynapseStore()`
- `saveSynapseStore()`
- `createSeedStore()`
- `normalizeSynapseCards()`
- `mergeSynapseCards()`
- `createProgressForCards()`
- `ensureProgressForCards()`
- `exportDeck()`
- `getStrength()`
- `pickWeakestQueue()`
- `buildQuizQueue()`
- `getTopicStats()`

Affected private helpers:

- `loadLegacyStore()`
- `normalizePersistentState()`
- `createSeedProgress()`
- `normalizeSynapseCard()`
- `slugify()`

Why it matters:

- `card.id` is currently the authored item ID, local deck key, quiz question
  ID, and progress key.
- Progress maps use `progress[card.id]`.
- Adding `itemId` can be a compatibility alias for current `id` at first.
- Adding `packId` requires either compound progress keys or progress entries
  that include pack identity.
- `exportDeck()` is the clean export seam and should map shared package fields
  without leaking progress.
- `learningRevision` belongs with progress/review state if it describes the
  learner's state against an item revision.

### `src/utils/cardPacks.js`

Affected exported symbols:

- `PACK_TEMPLATE`
- `parseCardPackMarkdown()`
- `parseDeckJson()`
- `downloadTextFile()`

Affected private helpers:

- `FIELD_ALIASES`
- `readMetadataLine()`
- `applyCardField()`
- `finalizeCards()`
- `parseFieldLine()`
- `slugify()`

Why it matters:

- Markdown metadata has `pack` and `version`, but no `packId`.
- Parsed metadata is not persisted by the app.
- Parsed cards use `id`, not `itemId`.
- Related values resolve within one imported pack and are returned as IDs
  without pack namespace.

### `src/App.jsx`

Affected state and functions:

- `store`
- `cards`
- `persistent`
- `flash`
- `quiz`
- `focus`
- `metrics`
- `startFlash()`
- `gradeFlash()`
- `startQuiz()`
- `answerQuiz()`
- `enterFocus()`
- `beginFocus()`
- `gradeFocus()`
- `recordAnswer()`
- `recordSession()`
- `addCard()`
- `importCards()`
- `replaceCards()`

Why it matters:

- All queues contain card IDs.
- `recordAnswer()` writes progress under `progress[cardId]`.
- Import and replace functions do not receive or persist pack metadata.
- Manual cards need a default local pack or an explicit pack selection.
- Metrics assume a single merged deck.

### `src/components/LibraryScreen.jsx`

Affected exported symbols:

- `LibraryScreen` default export

Affected functions:

- `submitCard()`
- `exportJson()`
- `downloadTemplate()`
- `importJson()`
- `importPack()`

Why it matters:

- This is the UI seam for clean export, Markdown import, JSON replace, and
  manual authored card creation.
- Import metadata is currently used only in a success message.
- Export uses `exportDeck(cards)` and currently has no pack selector.

### `src/data/synapseCards.js`

Affected exported symbols:

- `SEED_CARDS`
- `SEED_STRENGTHS`

Why it matters:

- Seed IDs are stable current item IDs.
- Seed strengths are keyed by card ID.
- Introducing a default seed pack must preserve current IDs or migrate existing
  progress.

### `src/screens/FlashcardsScreen.jsx`

Affected exported symbols:

- `FlashcardsScreen` default export

Why it matters:

- Looks up cards by queue ID.
- Reads strength by `getStrength(persistent.progress, card.id)`.

### `src/screens/FocusScreen.jsx`

Affected exported symbols:

- `FocusScreen` default export

Why it matters:

- Focus queue contains card IDs.
- Focus `before` state is keyed by card ID.
- Strength deltas are keyed by card ID.

### `src/screens/QuizScreen.jsx`

Affected exported symbols:

- `QuizScreen` default export

Why it matters:

- Quiz questions use card IDs.
- Answer options use option card IDs.
- React keys use `question.id` and `option.id`.

### `src/screens/HomeScreen.jsx` And `src/screens/ProgressScreen.jsx`

Affected exported symbols:

- `HomeScreen` default export
- `ProgressScreen` default export

Why it matters:

- Both consume derived metrics from `App`.
- Topic mastery and weak concepts assume a single merged deck and card-ID keyed
  progress.

### `src/screens/SettingsScreen.jsx` And `src/components/Shell.jsx`

Affected exported symbols:

- `SettingsScreen` default export
- `TopBar()`
- `BottomNav()`

Why it matters:

- Theme and sound are app/user preferences.
- These should remain separate from pack-level `ThemeMetadata` unless a shared
  package defines pack themes and the app maps them safely.

### CSS Files

Affected files:

- `src/styles/base-shell.css`
- `src/styles/home.css`
- `src/styles/practice.css`
- `src/styles/quiz-library.css`
- `src/styles/focus-progress-nav.css`
- `src/styles/motion.css`
- `src/styles/responsive.css`

Why it matters:

- Pack theme support would need a safe mapping into existing CSS variables.
- Current themes are named app themes, not portable pack themes.

### Documentation And Templates

Affected files:

- `FLASHCARD_PACKS.md`
- `src/utils/cardPacks.js` `PACK_TEMPLATE`
- Future `docs/learning-packs/source/*` files

Why it matters:

- The shared package should own portable schema terms.
- Flashiet docs should describe adapter behavior and compatibility only.
- Pack-generation instructions need to stay aligned with parser support.

## Recommended Integration Seams

- Treat `src/lib/synapseModel.js` as the main Flashiet adapter boundary.
- Keep `src/utils/cardPacks.js` as the current Markdown compatibility parser,
  but put strict portable schema parsing/validation in the shared package.
- Add a small mapping layer from shared `LearningPack` to current Flashiet cards
  `{ id, term, topic, def, short, tags, related }`.
- Preserve current `card.id` as a legacy alias for shared `itemId` during the
  first migration.
- Add a separate pack registry inside the `synapse_v2` store instead of
  duplicating pack metadata onto every card.
- Keep learner progress in `persistent.progress`, but make it pack-aware before
  allowing multiple packs with overlapping `itemId` values.
- Use `exportDeck()` as the first clean export seam because it already strips
  private progress.
- Use `LibraryScreen.importPack()` and `App.importCards()` as the first import
  seams because they already merge packs without resetting progress.
- Add a validation report object for imports before changing runtime behavior.
- Keep app themes separate from shared `ThemeMetadata`; later, map pack themes
  through allowlisted CSS tokens only.

## Expected Migration Risks

- Existing progress is keyed by `card.id`; moving to `packId:itemId` needs a
  compatibility migration.
- Seed progress in `SEED_STRENGTHS` is keyed by card ID.
- Manual cards have no pack identity and can overwrite existing cards with the
  same slugified term/ID.
- Markdown pack metadata is not persisted, so imported pack identity and
  version are currently lost.
- Multiple packs can collide if they use the same explicit card IDs.
- `replaceCards()` resets progress for the new deck and totals/history, which
  is correct for a deck restore path but not for app-to-app pack sync.
- `related` is preserved but unused; adding graph behavior could change quiz
  and focus behavior.
- JSON export is clean of progress today, but it hardcodes pack metadata and
  does not include pack version or stable pack ID.
- `synapse_v2` has no explicit schema version field inside the stored object.
- Legacy migration from `synapse_v1` uses current seed cards rather than
  migrating arbitrary legacy card content.
- Import validation is lossy and string-only; warnings such as unresolved
  related links are not exposed.
- There is no review event ledger, only aggregate progress and session history.

## Smallest First Implementation Slice

After the shared package owns the portable schema, the smallest safe slice is:

1. Add focused tests around existing Markdown parsing, JSON export, JSON
   replace, and Markdown merge behavior.
2. Add a Flashiet adapter that maps shared `LearningPack` into the current
   normalized card shape, using `itemId` as current `id`.
3. Persist a minimal pack registry in `synapse_v2`, keyed by `packId`, while
   leaving the current `cards` array and screen props compatible.
4. Make progress keys pack-aware for newly imported shared packs while keeping
   legacy card-ID progress lookup for existing local data.
5. Update `exportDeck()` or add a sibling export function that emits shared
   package data once the shared schema exists.

## Tests That Should Protect Existing Markdown Imports

- `parseCardPackMarkdown()` parses `Pack`, `Description`, `Version`,
  `Default Concept`, and `Default Tags`.
- `Title` acts as a `Pack` alias.
- `## Card: Term` sets the term when no `Term:` field is present.
- Explicit `Id:` is slugified and preserved.
- Missing `Id:` generates `<pack slug>-<term slug>`.
- `Tags` and `Tag` aliases parse comma-separated lists.
- `Related` and `Links` aliases resolve to imported card IDs by term or ID.
- Unresolved `Related` values keep current slugify behavior.
- Cards missing `Definition` are dropped.
- A pack with zero valid cards throws the current "No cards found" error.
- Multiline definitions continue only after `Definition`.
- Unknown metadata fields before the first card are ignored.
- `normalizeSynapseCards()` maps Markdown `definition` to `def`.
- `normalizeSynapseCards()` maps Markdown `concept` to `topic`.
- `normalizeSynapseCards()` preserves `tags` and `related`.
- Markdown import via `App.importCards()` merges cards by ID and preserves
  existing `persistent.progress`.
- JSON replace via `App.replaceCards()` replaces the deck and creates fresh
  progress.
- `exportDeck()` does not include `persistent.progress`, theme, sound, streaks,
  totals, or history.
- Seed card IDs in `SEED_CARDS` still normalize unchanged.

## Data That Cannot Currently Round-Trip Safely

- Markdown pack metadata cannot round-trip because imported metadata is not
  persisted.
- `packId`, `packVersion`, `itemId`, and `learningRevision` cannot round-trip
  because they do not exist in the current stored model.
- JSON export hardcodes `pack: 'Synapse Deck'` and does not preserve original
  imported pack identity or version.
- `short` can be derived locally and exported only if a future exporter chooses
  to include it; current `exportDeck()` omits it.
- Unknown Markdown metadata and card fields cannot round-trip because the
  parser drops or ignores unsupported fields.
- Unknown JSON card properties cannot round-trip because
  `normalizeSynapseCard()` returns only known fields.
- Unresolved Markdown `Related` values cannot round-trip with validation
  fidelity because they are slugified without a warning.
- Learner progress cannot round-trip through deck JSON export by design.
- Review events cannot round-trip because the app stores aggregate progress and
  recent session accuracy, not a per-answer event log.
- Pack theme metadata cannot round-trip because current theme state is app/user
  presentation state, not imported/exported pack metadata.
