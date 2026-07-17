import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

const landingHtml = await readFile(
  new URL('../website/index.html', import.meta.url),
  'utf8',
)
const demoHtml = await readFile(
  new URL('../website/demo/index.html', import.meta.url),
  'utf8',
)
const landingDocument = new JSDOM(landingHtml).window.document
const demoDocument = new JSDOM(demoHtml).window.document

test('declares the approved metadata without remote runtime assets', () => {
  assert.equal(
    landingDocument.title,
    'Concourse — Learning should have a route',
  )
  assert.equal(
    landingDocument
      .querySelector('link[rel="canonical"]')
      ?.getAttribute('href'),
    'https://concourse.conalhickey.com/',
  )
  assert.equal(
    landingDocument
      .querySelector('meta[name="description"]')
      ?.getAttribute('content'),
    'Concourse is an open-source, local-first system for guided learning routes, active recall, and portable course packs.',
  )

  for (const page of [landingDocument, demoDocument]) {
    for (const element of page.querySelectorAll(
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
  }
})

test('contains the approved hero and contributor-first actions', () => {
  assert.equal(
    landingDocument.querySelector('h1')?.textContent?.trim(),
    'Learning should have a route.',
  )
  assert.equal(
    landingDocument.querySelector('[data-primary-cta]')?.textContent?.trim(),
    'Explore the demo',
  )
  assert.equal(
    landingDocument.querySelector('[data-primary-cta]')?.getAttribute('href'),
    './demo/',
  )
  assert.equal(
    landingDocument.querySelector('[data-github-cta]')?.getAttribute('href'),
    'https://github.com/Conalh/Concourse',
  )
})

test('keeps the landing page editorial and links into the full demo', () => {
  for (const id of ['demo', 'system', 'contribute', 'status']) {
    assert.ok(landingDocument.getElementById(id), `missing #${id}`)
  }
  assert.equal(landingDocument.querySelector('[data-course]'), null)
  assert.equal(landingDocument.querySelector('script[src$="main.js"]'), null)
  assert.match(
    landingDocument.querySelector('#demo')?.textContent ?? '',
    /open the full demo/i,
  )
  assert.ok(landingDocument.querySelectorAll('a[href="./demo/"]').length >= 4)
})

test('gives the living course a canonical dedicated page', () => {
  assert.equal(demoDocument.body.classList.contains('demo-page'), true)
  assert.equal(
    demoDocument.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    'https://concourse.conalhickey.com/demo/',
  )
  assert.equal(
    demoDocument.querySelector('script[type="module"]')?.getAttribute('src'),
    '../main.js',
  )

  const course = demoDocument.querySelector('[data-course]')
  assert.ok(course)
  assert.equal(demoDocument.querySelectorAll('[data-course]').length, 1)
  assert.ok(course.querySelector('[data-course-entry]'))
  assert.ok(course.querySelector('[data-course-workspace]'))
  assert.ok(course.querySelector('[data-course-route]'))
  assert.ok(course.querySelector('[data-course-stage]'))
  assert.ok(course.querySelector('[data-course-context]'))
  assert.ok(course.querySelector('[data-course-status][aria-live="polite"]'))
  for (const selector of [
    '[data-course-heading]',
    '[data-mode-trigger]',
    '[data-mode-palette]',
    '[data-resume-notice]',
    '[data-course-route-disclosure]',
    '[data-course-context-disclosure]',
  ]) {
    assert.ok(course.querySelector(selector), `missing ${selector}`)
  }
  const stage = course.querySelector('[data-course-stage]')
  const route = course.querySelector('[data-course-route-disclosure]')
  const context = course.querySelector('[data-course-context-disclosure]')
  assert.ok(stage.compareDocumentPosition(route) & 4)
  assert.ok(stage.compareDocumentPosition(context) & 4)
  assert.equal(course.querySelector('[data-demo-panel]'), null)
  assert.equal(course.querySelector('[data-demo]'), null)
  assert.match(
    demoDocument.querySelector('.static-course')?.textContent ?? '',
    /Coach.*Flow.*Test.*Rescue.*Zoom.*Recap/is,
  )
})

test('provides the complete six-chapter no-JavaScript course', () => {
  const staticCourse = demoDocument.querySelector('.static-course')
  assert.ok(staticCourse)
  for (const chapter of [
    'Hold the boundary',
    'Move matter',
    'Survive salt shock',
    'Pay for movement',
    'Build a response',
    'Face an antibiotic',
  ]) {
    assert.match(staticCourse.textContent, new RegExp(chapter, 'i'))
  }
  for (const explanation of [
    'cell membrane',
    'cell wall',
    'net movement',
    'osmosis',
    'energy-coupled',
    'DNA',
    'ribosome',
    'antibiotic',
  ]) {
    assert.match(staticCourse.textContent, new RegExp(explanation, 'i'))
  }
  assert.ok(staticCourse.querySelectorAll('details').length >= 6)
  const staticExplanations = staticCourse.querySelectorAll(
    '.static-chapters > li > p',
  )
  assert.equal(staticExplanations.length, 6)
  for (const explanation of staticExplanations) {
    assert.ok(explanation.querySelectorAll('strong').length >= 2)
  }
})

test('states the local persistence and scientific boundaries', () => {
  const text = demoDocument.querySelector('[data-course]')?.textContent ?? ''
  assert.match(text, /saved (only )?on this device/i)
  assert.match(text, /session-only/i)
  assert.match(text, /start over/i)
  assert.match(text, /mechanisms\s+vary/i)
  assert.match(text, /no account/i)
  assert.match(text, /not treatment guidance/i)
})

test('includes adaptation rules pack mapping and scientific references', () => {
  const staticCourse = demoDocument.querySelector('.static-course')
  assert.match(staticCourse.textContent, /strong evidence/i)
  assert.match(staticCourse.textContent, /support recommended/i)
  assert.match(staticCourse.textContent, /delayed retrieval/i)
  for (const fileName of [
    'pack.json',
    'catalog.json',
    'courses.json',
    'items.json',
  ]) {
    assert.match(
      staticCourse.textContent,
      new RegExp(fileName.replace('.', '\\.')),
    )
  }
  const references = demoDocument.querySelector('[data-course-references]')
  assert.ok(references)
  assert.ok(references.querySelectorAll('a[href]').length >= 4)
})

test('uses verified contribution destinations', () => {
  const hrefs = [...landingDocument.querySelectorAll('#contribute a')].map(
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
  const text = `${landingDocument.body.textContent ?? ''} ${demoDocument.body.textContent ?? ''}`
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
