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

  assert.equal(landingDocument.querySelector('[data-demo]'), null)
  assert.equal(landingDocument.querySelector('script[src$="main.js"]'), null)
  assert.match(
    landingDocument.querySelector('#demo')?.textContent ?? '',
    /open the full demo/i,
  )
  assert.ok(landingDocument.querySelectorAll('a[href="./demo/"]').length >= 4)
})

test('gives the interactive workspace a canonical dedicated page', () => {
  assert.equal(demoDocument.body.classList.contains('demo-page'), true)
  assert.equal(
    demoDocument.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    'https://concourse.conalhickey.com/demo/',
  )
  assert.equal(
    demoDocument.querySelector('script[type="module"]')?.getAttribute('src'),
    '../main.js',
  )

  const demo = demoDocument.querySelector('[data-demo]')
  assert.ok(demo)
  assert.equal(demo.querySelectorAll('[data-demo-panel]').length, 6)
  assert.equal(demo.querySelectorAll('[data-route-node]').length, 4)
  assert.ok(demo.querySelector('[data-demo-form="prediction"]'))
  assert.equal(demo.querySelectorAll('[name="molecule"]').length, 3)
  assert.equal(demo.querySelectorAll('[name="confidence"]').length, 2)
  assert.ok(demo.querySelector('[data-membrane-figure]'))
  assert.ok(demo.querySelector('[data-evidence-context]'))
  assert.ok(demo.querySelector('[data-pack-inspector]'))
  assert.ok(demo.querySelector('[data-demo-status][aria-live="polite"]'))
  assert.ok(demo.querySelector('[data-demo-progress]'))
})

test('starts inside the learning experience without a dead start screen', () => {
  const demoText = demoDocument.querySelector('[data-demo]')?.textContent ?? ''
  assert.equal(demoText.includes('Start this route'), false)
  assert.match(demoText, /which crosses most easily/i)
})

test('declares the unpacked draft inspector contract', () => {
  const inspector = demoDocument.querySelector('[data-pack-inspector]')
  assert.ok(inspector)
  assert.match(inspector.textContent ?? '', /unpacked local draft/i)
  assert.ok(inspector.querySelector('[role="tablist"]'))
  assert.ok(inspector.querySelector('[role="tabpanel"] [data-pack-code]'))
  assert.ok(inspector.querySelector('[data-demo-action="toggle-dna-route"]'))
  assert.ok(inspector.querySelector('[data-draft-status]'))
})

test('describes the completed route consistently', () => {
  const pack = demoDocument.querySelector('[data-demo-panel="pack"]')
  assert.ok(pack)
  assert.match(pack.textContent, /two activities completed/i)
  assert.doesNotMatch(pack.textContent, /one activity completed/i)
})

test('uses the approved route, workspace, and context hierarchy', () => {
  const workspace = demoDocument.querySelector('.lab-workspace')
  assert.ok(workspace)
  assert.ok(workspace.querySelector(':scope > .lab-route'))
  assert.ok(workspace.querySelector(':scope > .lab-center'))
  assert.ok(workspace.querySelector(':scope > .lab-context'))
  assert.ok(workspace.querySelector('.lab-center > [data-membrane-figure]'))
  assert.ok(workspace.querySelector('.lab-center > .lab-activity'))
})

test('provides the complete no-JavaScript explanation', () => {
  const staticDemo = demoDocument.querySelector('.static-demo')
  assert.ok(staticDemo)
  assert.match(staticDemo.textContent, /oxygen/i)
  assert.match(staticDemo.textContent, /charge and size/i)
  assert.match(staticDemo.textContent, /transport protein/i)
  assert.match(staticDemo.textContent, /catalog\.json/i)
  assert.match(staticDemo.textContent, /unpacked/i)
})

test('declares textual prediction validation feedback', () => {
  const error = demoDocument.querySelector('[data-prediction-error]')
  assert.ok(error)
  assert.equal(error.getAttribute('role'), 'status')
  assert.equal(error.getAttribute('tabindex'), '-1')
  assert.match(error.textContent, /choose/i)
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
