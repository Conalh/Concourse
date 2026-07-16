import { describe, expect, it, vi } from 'vitest'

import { EvidenceIdSchema, SessionIdSchema } from '../../core/contracts'
import type { LearningIdGenerator } from '../../core/ports'
import {
  CryptoLearningIdGenerator,
  createBrowserLearningIdGenerator,
} from '../../infrastructure'

describe('CryptoLearningIdGenerator', () => {
  it('creates deterministic schema-valid prefixed IDs from an injected UUID source', () => {
    const generator: LearningIdGenerator = new CryptoLearningIdGenerator({
      randomUUID: () => 'ABCDEF12-3456-7890-ABCD-EF1234567890',
    })

    expect(generator.createSessionId()).toBe(
      'session-abcdef12-3456-7890-abcd-ef1234567890',
    )
    expect(generator.createEvidenceId()).toBe(
      'evidence-abcdef12-3456-7890-abcd-ef1234567890',
    )
    expect(() =>
      SessionIdSchema.parse(generator.createSessionId()),
    ).not.toThrow()
    expect(() =>
      EvidenceIdSchema.parse(generator.createEvidenceId()),
    ).not.toThrow()
  })

  it('does not use weak randomness and fails when browser UUID generation is unavailable', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('weak randomness used')
    })

    try {
      const generator = new CryptoLearningIdGenerator({
        randomUUID: () => '11111111-1111-4111-8111-111111111111',
      })
      expect(generator.createSessionId()).toBe(
        'session-11111111-1111-4111-8111-111111111111',
      )
    } finally {
      randomSpy.mockRestore()
    }

    vi.stubGlobal('crypto', {})
    try {
      expect(() => createBrowserLearningIdGenerator()).toThrow(
        'Secure randomUUID is unavailable.',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('preserves the browser UUID source receiver when creating IDs', () => {
    const source = {
      prefix: '22222222',
      randomUUID() {
        return `${this.prefix}-2222-4222-8222-222222222222`
      },
    }

    vi.stubGlobal('crypto', source)
    try {
      const generator = createBrowserLearningIdGenerator()

      expect(generator.createSessionId()).toBe(
        'session-22222222-2222-4222-8222-222222222222',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
