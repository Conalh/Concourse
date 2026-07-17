import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const baseStyles = await readFile(
  new URL('../website/styles.css', import.meta.url),
  'utf8',
)
const demoStyles = await readFile(
  new URL('../website/demo.css', import.meta.url),
  'utf8',
)
const styles = `${baseStyles}\n${demoStyles}`

function ruleBody(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))
  assert.ok(match, `missing ${selector} rule`)
  return match[1]
}

function colorToken(name) {
  const match = styles.match(new RegExp(`--${name}:\\s*(#[\\da-f]{6})`, 'i'))
  assert.ok(match, `missing --${name} color token`)
  return match[1]
}

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const channels = hex
      .slice(1)
      .match(/.{2}/g)
      .map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4,
      )
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

test('keeps hidden state authoritative at every breakpoint', () => {
  assert.match(styles, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important;/s)
  assert.doesNotMatch(demoStyles, /\[hidden\][^{]*\{[^}]*display:\s*(?!none)/)
})

test('does not retain selectors from the retired guided demo', () => {
  assert.doesNotMatch(
    styles,
    /\.demo-stage|\[data-demo-|\[data-route-node\]\[data-state/,
  )
})

test('gives the course a route stage and context without crushing the stage', () => {
  assert.match(
    ruleBody('.course-workspace'),
    /grid-template-columns:\s*minmax\(12rem,\s*0\.55fr\)\s+minmax\(28rem,\s*1\.65fr\)\s+minmax\(\s*18rem,\s*0\.8fr\s*\);/,
  )
  assert.match(
    demoStyles,
    /@media\s*\(max-width:\s*72rem\)[\s\S]*?\.course-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(10rem,\s*0\.45fr\)\s+minmax\(0,\s*1fr\);/,
  )
  assert.match(
    demoStyles,
    /@media\s*\(max-width:\s*52rem\)[\s\S]*?\.course-workspace\s*\{[^}]*grid-template-columns:\s*1fr;/,
  )
})

test('gives the dedicated course the full site width', () => {
  assert.match(ruleBody('.demo-page main'), /display:\s*block;/)
  assert.match(
    ruleBody('.demo-page main'),
    /width:\s*min\(100%,\s*var\(--content-width\)\);/,
  )
  assert.match(ruleBody('.course-shell'), /min-width:\s*0;/)
})

test('keeps the Concourse brand visible on the dark course header', () => {
  assert.match(ruleBody('.demo-page .brand'), /color:\s*var\(--paper\);/)
  assert.match(ruleBody('.demo-page .brand img'), /filter:\s*invert\(1\);/)
})

test('keeps all course controls touch safe with responsive press feedback', () => {
  assert.match(
    demoStyles,
    /\.course-shell\s+:is\(button,\s*select,\s*summary\)\s*\{[^}]*min-height:\s*2\.75rem;/s,
  )
  assert.match(
    demoStyles,
    /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)[\s\S]*?\.course-shell button:active:not\(:focus-visible\)\s*\{[^}]*transform:\s*scale\(0\.97\);/,
  )
  assert.doesNotMatch(demoStyles, /transition:\s*all/)
})

test('makes route states textual and pack overflow internal', () => {
  for (const state of [
    'completed',
    'current',
    'available',
    'skipped',
    'upcoming',
  ]) {
    assert.match(
      demoStyles,
      new RegExp(`\\[data-route-status=['"]${state}['"]\\]`),
    )
  }
  assert.match(ruleBody('.course-context pre'), /overflow:\s*auto;/)
  assert.match(ruleBody('.course-context pre'), /max-width:\s*100%;/)
  assert.match(ruleBody('.course-stage'), /min-width:\s*0;/)
})

test('recomposes route and context for narrow screens and zoom', () => {
  assert.match(
    demoStyles,
    /@media\s*\(max-width:\s*52rem\)[\s\S]*?\.course-route\s*\{[^}]*overflow-x:\s*auto;/,
  )
  assert.match(
    demoStyles,
    /@media\s*\(max-width:\s*52rem\)[\s\S]*?\.course-stage\s*\{[^}]*order:\s*1;/,
  )
  assert.doesNotMatch(
    ruleBody('body'),
    /(?:min-width|overflow-x:\s*hidden)\s*:/,
  )
})

test('honors reduced motion and only transitions composited properties', () => {
  assert.match(
    demoStyles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.course-shell \*\s*\{[^}]*transition-duration:\s*0\.01ms(?:\s*!important)?;/,
  )
  for (const transition of demoStyles.matchAll(/transition:\s*([^;]+);/g)) {
    assert.doesNotMatch(
      transition[1],
      /(?:width|height|margin|padding|left|right|top|bottom)/,
    )
  }
})

test('keeps no-JavaScript content and mobile navigation usable', () => {
  assert.match(
    ruleBody('html:not(.js) [data-course-entry]'),
    /display:\s*none;/,
  )
  assert.match(
    ruleBody('html:not(.js) .static-course summary'),
    /min-height:\s*2\.75rem;/,
  )
  assert.match(
    styles,
    /@media\s*\(max-width:\s*52rem\)[\s\S]*?\.site-header \.brand,[\s\S]*?min-height:\s*2\.75rem;/,
  )
})

test('uses focus indicators with at least three-to-one adjacent contrast', () => {
  assert.ok(contrastRatio(colorToken('cobalt'), colorToken('canvas')) >= 3)
  assert.ok(contrastRatio(colorToken('lime'), colorToken('midnight')) >= 3)
  assert.match(styles, /--focus-light:\s*var\(--cobalt\);/)
  assert.match(styles, /--focus-dark:\s*var\(--lime\);/)
  assert.match(
    ruleBody(':focus-visible'),
    /outline:\s*3px solid var\(--focus-light\);/,
  )
  assert.match(
    demoStyles,
    /\.course-shell :focus-visible\s*\{[^}]*outline-color:\s*var\(--focus-dark\);/,
  )
})
