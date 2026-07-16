import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const styles = await readFile(
  new URL('../website/styles.css', import.meta.url),
  'utf8',
)

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

test('keeps hidden demo state authoritative at every breakpoint', () => {
  assert.match(styles, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important;/s)
  assert.match(
    styles,
    /\.demo-stage\s+\[data-demo-panel='route'\]:not\(\[hidden\]\)\s*\{\s*display:\s*block;/,
  )
})

test('preserves each enhanced control layout and does not mask overflow', () => {
  assert.doesNotMatch(styles, /\.js\s+\.enhanced-control\s*\{/)
  assert.match(
    ruleBody('.js button.enhanced-control'),
    /display:\s*inline-flex;/,
  )
  assert.match(
    ruleBody('.js .demo-actions.enhanced-control'),
    /display:\s*flex;/,
  )
  assert.match(
    ruleBody('.js .answer-grid.enhanced-control'),
    /display:\s*grid;/,
  )
  assert.match(ruleBody('.js .feedback.enhanced-control'), /display:\s*block;/)
  assert.doesNotMatch(ruleBody('body'), /overflow-x:\s*hidden;/)
  assert.match(
    styles,
    /@media\s*\(max-width:\s*52rem\)[\s\S]*?\.answer-grid\s*\{[^}]*grid-template-columns:\s*1fr;/,
  )
})

test('uses focus indicators with at least 3 to 1 adjacent contrast', () => {
  const lightRatio = contrastRatio(colorToken('cobalt'), colorToken('canvas'))
  const darkRatio = contrastRatio(colorToken('lime'), colorToken('midnight'))
  const cobaltRatio = contrastRatio(colorToken('ink'), colorToken('cobalt'))

  assert.ok(
    lightRatio >= 3,
    `light focus contrast is ${lightRatio.toFixed(2)}:1`,
  )
  assert.ok(darkRatio >= 3, `dark focus contrast is ${darkRatio.toFixed(2)}:1`)
  assert.ok(
    cobaltRatio >= 3,
    `cobalt-surface focus contrast is ${cobaltRatio.toFixed(2)}:1`,
  )

  assert.match(styles, /--focus-light:\s*var\(--cobalt\);/)
  assert.match(styles, /--focus-dark:\s*var\(--lime\);/)
  assert.match(
    ruleBody(':focus-visible'),
    /outline:\s*3px solid var\(--focus-light\);/,
  )
  assert.match(
    ruleBody('.button-primary:focus-visible'),
    /outline-color:\s*var\(--ink\);/,
  )
  assert.match(
    styles,
    /\.demo-section\s+:focus-visible,[\s\S]*?\.final-invitation\s+:focus-visible,[\s\S]*?\.skip-link:focus-visible\s*\{[^}]*outline-color:\s*var\(--focus-dark\);/,
  )
})
