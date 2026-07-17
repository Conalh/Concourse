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

test('keeps hidden demo state authoritative at every breakpoint', () => {
  assert.match(styles, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important;/s)
  assert.doesNotMatch(demoStyles, /\[hidden\][^{]*\{[^}]*display:\s*(?!none)/)
})

test('preserves each enhanced control layout and does not mask overflow', () => {
  assert.doesNotMatch(styles, /\.js\s+\.enhanced-control\s*\{/)
  assert.match(
    ruleBody('.js button.enhanced-control'),
    /display:\s*inline-flex;/,
  )
  assert.doesNotMatch(ruleBody('body'), /overflow-x:\s*hidden;/)
})

test('lays out the learning lab as route, learning center, and context', () => {
  assert.match(
    ruleBody('.lab-workspace'),
    /grid-template-columns:\s*minmax\(\s*9rem,\s*0\.55fr\)\s+minmax\(\s*18rem,\s*1\.45fr\)\s+minmax\(\s*15rem,\s*0\.8fr\s*\);/,
  )
  assert.match(ruleBody('.lab-route'), /display:\s*grid;/)
  assert.match(ruleBody('.lab-context'), /min-width:\s*0;/)
})

test('keeps lab controls touch-safe and press motion pointer-only', () => {
  assert.match(
    demoStyles,
    /\.learning-lab button\s*\{[^}]*min-height:\s*2\.75rem;/s,
  )
  assert.match(
    demoStyles,
    /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)[\s\S]*?transform:\s*scale\(0\.97\);/,
  )
})

test('makes the full custom-choice surface an actual input hit area', () => {
  const choiceInput = ruleBody('.choice-set input')
  const choiceLabel = ruleBody('.choice-set label > span')

  assert.match(choiceInput, /inset:\s*0;/)
  assert.match(choiceInput, /width:\s*100%;/)
  assert.match(choiceInput, /height:\s*100%;/)
  assert.match(choiceInput, /opacity:\s*0;/)
  assert.match(choiceLabel, /pointer-events:\s*none;/)
})

test('stacks the lab without horizontal page overflow and honors reduced motion', () => {
  assert.match(
    demoStyles,
    /@media\s*\(max-width:\s*52rem\)[\s\S]*?\.lab-workspace\s*\{[^}]*grid-template-columns:\s*1fr;/,
  )
  assert.match(
    demoStyles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.molecule\s*\{[^}]*transition:\s*none;/,
  )
  assert.doesNotMatch(demoStyles, /transition:\s*all/)
})

test('allows the narrow layout to account for a vertical scrollbar', () => {
  assert.doesNotMatch(
    ruleBody('body'),
    /min-width\s*:/,
    'body width floors create horizontal overflow at a 320px viewport',
  )
})

test('keeps mobile navigation and editorial links at least 44px tall', () => {
  const mobileStart = styles.indexOf('@media (max-width: 52rem)')
  const nextBreakpoint = styles.indexOf('@media (max-width: 30rem)')
  const mobileStyles = styles.slice(mobileStart, nextBreakpoint)

  assert.match(
    mobileStyles,
    /\.site-header \.brand,\s*\.first-contribution a,\s*\.local-boundary > a,\s*footer \.brand,\s*footer nav a\s*\{[^}]*min-height:\s*2\.75rem;/s,
  )
})

test('keeps enhanced controls inert and hidden until JavaScript mounts', () => {
  assert.match(
    styles,
    /html:not\(\.js\) \.enhanced-control\s*\{[^}]*display:\s*none\s*!important;/s,
  )
})

test('keeps the no-JavaScript answer disclosure at least 44px tall', () => {
  const summary = ruleBody('html:not(.js) .static-demo summary')

  assert.match(summary, /display:\s*flex;/)
  assert.match(summary, /align-items:\s*center;/)
  assert.match(summary, /min-height:\s*2\.75rem;/)
})

test('hides runtime-only progress when JavaScript is unavailable', () => {
  assert.match(
    ruleBody('html:not(.js) [data-demo-progress]'),
    /display:\s*none;/,
  )
})

test('uses focus indicators with at least 3 to 1 adjacent contrast', () => {
  const lightSurfaceRatio = contrastRatio(
    colorToken('cobalt'),
    colorToken('canvas'),
  )
  const darkSurfaceRatio = contrastRatio(
    colorToken('lime'),
    colorToken('midnight'),
  )
  const primaryOnCanvasRatio = contrastRatio(
    colorToken('ink'),
    colorToken('canvas'),
  )

  assert.ok(
    lightSurfaceRatio >= 3,
    `light-surface focus contrast is ${lightSurfaceRatio.toFixed(2)}:1`,
  )
  assert.ok(
    darkSurfaceRatio >= 3,
    `dark-surface focus contrast is ${darkSurfaceRatio.toFixed(2)}:1`,
  )
  assert.ok(
    primaryOnCanvasRatio >= 3,
    `primary focus against canvas is ${primaryOnCanvasRatio.toFixed(2)}:1`,
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
    ruleBody('.skip-link:focus-visible'),
    /outline-color:\s*var\(--focus-light\);/,
  )
  assert.match(
    styles,
    /\.learning-lab \.button-demo:focus-visible,[\s\S]*?\.learning-lab button:focus-visible,[\s\S]*?\.final-invitation \.button-primary:focus-visible\s*\{[^}]*outline-color:\s*var\(--focus-dark\);/,
  )

  const genericPrimaryFocus = styles.indexOf('.button-primary:focus-visible')
  const skipLinkFocus = styles.lastIndexOf('.skip-link:focus-visible')
  const demoPrimaryFocus = styles.lastIndexOf(
    '.learning-lab .button-demo:focus-visible',
  )
  const invitationPrimaryFocus = styles.lastIndexOf(
    '.final-invitation .button-primary:focus-visible',
  )

  assert.ok(
    skipLinkFocus > genericPrimaryFocus,
    'skip-link surface override must follow generic primary focus',
  )
  assert.ok(
    demoPrimaryFocus > genericPrimaryFocus,
    'demo dark-surface override must follow generic primary focus',
  )
  assert.ok(
    invitationPrimaryFocus > genericPrimaryFocus,
    'invitation dark-surface override must follow generic primary focus',
  )
})
