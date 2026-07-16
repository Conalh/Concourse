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

test('stays within the uncompressed pre-CSS asset allowance', async () => {
  const sizes = await Promise.all(
    assetPaths.map((path) => stat(new URL(path, root))),
  )
  const total = sizes.reduce((sum, entry) => sum + entry.size, 0)
  assert.ok(total < 180_000, `asset total ${total} exceeds 180 KB`)
})
