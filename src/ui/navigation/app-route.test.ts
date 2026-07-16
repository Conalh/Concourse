import { describe, expect, it } from 'vitest'

import {
  ActivityIdSchema,
  ConceptIdSchema,
  SessionIdSchema,
  SubjectIdSchema,
} from '../../core/contracts'
import { formatRoute, parseHashRoute } from './app-route'

describe('hash app routes', () => {
  it('parses supported routes and formats them round-trip', () => {
    const subjectId = SubjectIdSchema.parse('logic-basics')
    const sessionId = SessionIdSchema.parse('session-0')
    const conceptId = ConceptIdSchema.parse('boolean-values')

    expect(parseHashRoute('#/')).toEqual({ kind: 'library' })
    expect(parseHashRoute('#/today')).toEqual({ kind: 'today' })
    expect(parseHashRoute('#/practice')).toEqual({ kind: 'practice' })
    expect(parseHashRoute('#/transfer')).toEqual({ kind: 'transfer' })
    expect(parseHashRoute('#/progress')).toEqual({ kind: 'progress' })
    expect(parseHashRoute('#/profile')).toEqual({ kind: 'profile' })
    expect(parseHashRoute('#/settings')).toEqual({ kind: 'settings' })
    expect(parseHashRoute('#/subjects/logic-basics')).toEqual({
      kind: 'subject',
      subjectId,
    })
    expect(parseHashRoute('#/sessions/session-0')).toEqual({
      kind: 'session',
      sessionId,
    })
    expect(
      parseHashRoute('#/sessions/session-0/concepts/boolean-values'),
    ).toEqual({
      kind: 'session-concept',
      sessionId,
      conceptId,
    })
    expect(parseHashRoute('#/sessions/session-0/recap')).toEqual({
      kind: 'session-recap',
      sessionId,
    })

    for (const route of [
      { kind: 'today' } as const,
      { kind: 'library' } as const,
      { kind: 'practice' } as const,
      { kind: 'transfer' } as const,
      { kind: 'progress' } as const,
      { kind: 'profile' } as const,
      { kind: 'settings' } as const,
      { kind: 'subject', subjectId } as const,
      { kind: 'session', sessionId } as const,
      { kind: 'session-concept', sessionId, conceptId } as const,
      { kind: 'session-recap', sessionId } as const,
    ]) {
      expect(parseHashRoute(formatRoute(route))).toEqual(route)
    }
  })

  it('returns not-found instead of throwing for malformed hashes and invalid branded IDs', () => {
    for (const hash of [
      '#/subjects/Logic Basics',
      '#/sessions/not valid',
      '#/sessions/not valid/concepts/boolean-values',
      '#/sessions/session-0/concepts/Not Valid',
      '#/sessions/session-0/summary',
      '#/unknown',
      '#/%E0%A4%A',
    ]) {
      expect(() => parseHashRoute(hash)).not.toThrow()
      expect(parseHashRoute(hash)).toMatchObject({ kind: 'not-found' })
    }
  })

  it('keeps workspace, recap, and related concept navigation distinct', () => {
    const sessionId = SessionIdSchema.parse('session-0')
    const first = ConceptIdSchema.parse('boolean-values')
    const related = ConceptIdSchema.parse('logical-negation')

    expect(parseHashRoute('#/sessions/session-0')).toEqual({
      kind: 'session',
      sessionId,
    })
    expect(parseHashRoute('#/sessions/session-0/recap')).toEqual({
      kind: 'session-recap',
      sessionId,
    })
    expect(
      formatRoute({ kind: 'session-concept', sessionId, conceptId: first }),
    ).toBe('#/sessions/session-0/concepts/boolean-values')
    expect(
      formatRoute({ kind: 'session-concept', sessionId, conceptId: related }),
    ).toBe('#/sessions/session-0/concepts/logical-negation')
  })

  it('round-trips resource routes with portable origin metadata', () => {
    const sessionId = SessionIdSchema.parse('session-0')
    const activityId = ActivityIdSchema.parse('item-negation-single-choice')
    const route = {
      kind: 'resource',
      packId: 'learnt.logic-foundations',
      resourceId: 'resource-logic-reading',
      segmentId: 'segment-reading-intro',
      origin: {
        kind: 'active-session',
        sessionId,
        activityId,
        returnRoute: '#/sessions/session-0',
      },
    } as const

    expect(parseHashRoute(formatRoute(route))).toEqual(route)
  })

  it('ignores invalid resource origin metadata without rejecting the resource route', () => {
    expect(
      parseHashRoute(
        '#/packs/learnt.logic-foundations/resources/resource-logic-reading?origin=%7B%22kind%22%3A%22active-session%22%2C%22sessionId%22%3A%22bad%20session%22%7D',
      ),
    ).toEqual({
      kind: 'resource',
      packId: 'learnt.logic-foundations',
      resourceId: 'resource-logic-reading',
    })
  })
})
