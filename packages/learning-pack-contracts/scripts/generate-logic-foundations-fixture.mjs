import { mkdir, writeFile } from 'node:fs/promises'
import { createLogicFoundationsGoldenFixture } from '../dist/index.js'

const root = new URL('../fixtures/logic-foundations/', import.meta.url)
const fixture = createLogicFoundationsGoldenFixture()

await mkdir(root, { recursive: true })
await mkdir(new URL('releases/', root), { recursive: true })
await mkdir(new URL('invalid/', root), { recursive: true })
await mkdir(new URL('snapshots/', root), { recursive: true })

for (const [version, pack] of Object.entries(fixture.releases)) {
  const releaseRoot = new URL(`releases/${version}/`, root)
  await mkdir(releaseRoot, { recursive: true })
  await mkdir(new URL('assets/', releaseRoot), { recursive: true })
  await writeJson(releaseRoot, 'pack.json', pack.manifest)
  await writeJson(releaseRoot, 'catalog.json', pack.catalog)
  await writeJson(releaseRoot, 'courses.json', pack.courses)
  await writeJson(releaseRoot, 'items.json', pack.items)
  await writeJson(releaseRoot, 'sets.json', pack.sets)
  if (pack.resources) {
    await writeJson(releaseRoot, 'resources.json', pack.resources)
  }
  if (pack.theme) {
    await writeJson(releaseRoot, 'theme.json', pack.theme)
  }
  if (pack.migrations) {
    await writeJson(releaseRoot, 'migrations.json', pack.migrations)
  }
  await writeFile(
    new URL('assets/logic-cover.svg', releaseRoot),
    svg('Logic Foundations', '#3366CC'),
  )
  await writeFile(
    new URL('assets/logic-icon.svg', releaseRoot),
    svg('LF', '#224488'),
  )
}

await writeJson(
  root,
  'invalid/missing-reference-pack.json',
  fixture.invalidPacks.missingReference,
)
await writeJson(
  root,
  'invalid/embedded-progress-pack.json',
  fixture.invalidPacks.embeddedLearnerProgress,
)
await writeJson(
  root,
  'snapshots/flashcard-mode.json',
  fixture.projectionSnapshots.flashcardMode,
)
await writeJson(
  root,
  'snapshots/quiz-mode.json',
  fixture.projectionSnapshots.quizMode,
)
await writeJson(
  root,
  'snapshots/curriculum-navigation.json',
  fixture.projectionSnapshots.curriculumNavigation,
)
await writeJson(
  root,
  'snapshots/subject-filtering.json',
  fixture.projectionSnapshots.subjectFiltering,
)
await writeJson(
  root,
  'snapshots/study-set-selection.json',
  fixture.projectionSnapshots.studySetSelection,
)
await writeJson(
  root,
  'expected-mastery-reset.json',
  fixture.masteryResetExample,
)
await writeJson(root, 'expected-update-plans.json', fixture.updateScenarios)

await writeFile(
  new URL('README.md', root),
  [
    '# Logic Foundations Golden Fixture',
    '',
    'This fixture exercises Learning Pack Contract v0.1 across four immutable releases.',
    '',
    '- `releases/1.0.0/` is the baseline pack.',
    '- `releases/1.0.1/` contains wording and additive metadata changes that preserve progress.',
    '- `releases/1.1.0/` adds new items.',
    '- `releases/2.0.0/` includes `migrations.json` and a `learningRevision` increase for `item-negation-single-choice`.',
    '- `snapshots/` contains expected projections for flashcard mode, quiz mode, curriculum navigation, subject filtering, and StudySet selection.',
    '- `invalid/` contains packs that consuming applications must reject.',
    '',
    'These files are generated from `src/logic-foundations-golden.ts`.',
  ].join('\n'),
)

async function writeJson(baseUrl, path, value) {
  const target = new URL(path.replaceAll('\\', '/'), baseUrl)
  await mkdir(new URL('./', target), { recursive: true })
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`)
}

function svg(label, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${color}"/><text x="600" y="330" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" fill="#ffffff">${label}</text></svg>\n`
}
