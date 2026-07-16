import { describe, expect, it } from 'vitest'

import type { Clock } from '../../core/ports'
import { SystemClock } from '../../infrastructure'

describe('SystemClock', () => {
  it('implements the Clock port with fresh valid Date objects', () => {
    const clock: Clock = new SystemClock()

    const first = clock.now()
    const second = clock.now()

    expect(first).toBeInstanceOf(Date)
    expect(second).toBeInstanceOf(Date)
    expect(Number.isNaN(first.getTime())).toBe(false)
    expect(Number.isNaN(second.getTime())).toBe(false)
    expect(first).not.toBe(second)
  })
})
