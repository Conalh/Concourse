import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'

const root = new URL('../website/', import.meta.url)
const assetPaths = [
  'assets/concourse-mark.svg',
  'assets/bacterial-cell.svg',
  'assets/instrument-sans.woff2',
  'assets/OFL.txt',
  'assets/social-preview.svg',
]
const approvedSvgPaints = new Set(
  [
    '#F6F7F2',
    '#10131A',
    '#5F6672',
    '#D7DAD1',
    '#2457FF',
    '#C7F34A',
    '#FF6B57',
    '#141B2D',
    'none',
    'currentColor',
  ].map((paint) => paint.toLowerCase()),
)

test('ships every approved asset locally', async () => {
  for (const path of assetPaths) {
    assert.ok((await stat(new URL(path, root))).size > 0, `${path} is empty`)
  }
})

test('keeps SVG assets vector-only and self-contained', async () => {
  for (const path of assetPaths.filter((path) => path.endsWith('.svg'))) {
    const svg = await readFile(new URL(path, root), 'utf8')
    assert.equal(/<image\b/i.test(svg), false, `${path} embeds raster content`)
    assert.equal(
      /https?:\/\//i.test(svg),
      false,
      `${path} loads remote content`,
    )
    assert.match(svg, /viewBox=/)
  }
})

test('uses only locked design-system colors in SVG assets', async () => {
  for (const path of assetPaths.filter((path) => path.endsWith('.svg'))) {
    const svg = await readFile(new URL(path, root), 'utf8')

    for (const color of svg.match(/#[\da-f]{3,8}\b/gi) ?? []) {
      assert.ok(
        approvedSvgPaints.has(color.toLowerCase()),
        `${path} uses unapproved color ${color}`,
      )
    }

    for (const [, paint] of svg.matchAll(
      /\b(?:fill|stroke)\s*=\s*["']([^"']+)["']/gi,
    )) {
      assert.ok(
        approvedSvgPaints.has(paint.toLowerCase()),
        `${path} uses unapproved paint ${paint}`,
      )
    }
  }
})

test('stays within the uncompressed pre-CSS asset allowance', async () => {
  const sizes = await Promise.all(
    assetPaths.map((path) => stat(new URL(path, root))),
  )
  const total = sizes.reduce((sum, entry) => sum + entry.size, 0)
  assert.ok(total < 180_000, `asset total ${total} exceeds 180 KB`)
})

test('keeps the guided runtime within its uncompressed JavaScript budget', async () => {
  const paths = [
    'main.js',
    'demo-activities.js',
    'demo-course.js',
    'demo-model.js',
    'demo-pack.js',
    'demo-render.js',
    'demo-routing.js',
    'demo-storage.js',
  ]
  const total = (
    await Promise.all(paths.map((path) => stat(new URL(path, root))))
  ).reduce((sum, entry) => sum + entry.size, 0)
  assert.ok(total < 90 * 1024, `demo JavaScript total ${total} exceeds 90 KB`)
})
