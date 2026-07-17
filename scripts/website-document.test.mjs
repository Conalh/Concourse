import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

const html = await readFile(
  new URL('../website/index.html', import.meta.url),
  'utf8',
)
const { document } = new JSDOM(html).window

test('declares the approved metadata without remote runtime assets', () => {
  assert.equal(document.title, 'Concourse — Learning should have a route')
  assert.equal(
    document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    'https://concourse.conalhickey.com/',
  )
  assert.equal(
    document.querySelector('meta[name="description"]')?.getAttribute('content'),
    'Concourse is an open-source, local-first system for guided learning routes, active recall, and portable course packs.',
  )

  for (const element of document.querySelectorAll(
    'script[src], link[rel="stylesheet"][href], link[rel="icon"][href], img[src]',
  )) {
    const source =
      element.getAttribute('src') ?? element.getAttribute('href') ?? ''
    assert.equal(
      /^https?:\/\//.test(source),
      false,
      `remote runtime asset: ${source}`,
    )
  }
})

test('contains the approved hero and contributor-first actions', () => {
  assert.equal(
    document.querySelector('h1')?.textContent?.trim(),
    'Learning should have a route.',
  )
  assert.equal(
    document.querySelector('[data-primary-cta]')?.textContent?.trim(),
    'Explore the demo',
  )
  assert.equal(
    document.querySelector('[data-primary-cta]')?.getAttribute('href'),
    '#demo',
  )
  assert.equal(
    document.querySelector('[data-github-cta]')?.getAttribute('href'),
    'https://github.com/Conalh/Concourse',
  )
})

test('provides every required section and demo hook', () => {
  for (const id of ['demo', 'system', 'contribute', 'status']) {
    assert.ok(document.getElementById(id), `missing #${id}`)
  }
  assert.ok(document.querySelector('[data-demo]'))
  assert.equal(document.querySelectorAll('[data-demo-panel]').length, 4)
  assert.equal(document.querySelectorAll('[data-route-node]').length, 3)
  assert.ok(document.querySelector('[data-demo-status][aria-live="polite"]'))
  assert.ok(document.querySelector('[data-demo-progress]'))
})

test('uses verified contribution destinations', () => {
  const hrefs = [...document.querySelectorAll('#contribute a')].map(
    (link) => link.href,
  )
  for (const expected of [
    'https://github.com/Conalh/Concourse/tree/main/src/ui',
    'https://github.com/Conalh/Concourse/tree/main/src/core',
    'https://github.com/Conalh/Concourse/tree/main/packages',
    'https://github.com/Conalh/Concourse/tree/main/docs/learning-packs',
  ]) {
    assert.ok(hrefs.includes(expected), `missing ${expected}`)
  }
})

test('does not introduce commercial or hosted-service claims', () => {
  const text = document.body.textContent ?? ''
  for (const forbidden of [
    'pricing',
    'sign up',
    'cloud sync',
    'marketplace',
    'newsletter',
  ]) {
    assert.equal(
      text.toLowerCase().includes(forbidden),
      false,
      `forbidden copy: ${forbidden}`,
    )
  }
})
