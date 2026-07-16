import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EvaluationFeedback } from './EvaluationFeedback'

describe('EvaluationFeedback', () => {
  it('summarizes criteria without exposing internal criterion identifiers', () => {
    render(
      <EvaluationFeedback
        evaluation={{
          status: 'retry',
          score: 0,
          feedback: 'Selection did not match the correct option set.',
          matchedCriteria: ['manual-completion'],
          missingCriteria: ['option-false'],
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByText('Reviewed answer')).toBeInTheDocument()
    expect(screen.getByText('1 satisfied / 1 remaining')).toBeInTheDocument()
    expect(screen.queryByText('manual-completion')).not.toBeInTheDocument()
    expect(screen.queryByText('option-false')).not.toBeInTheDocument()
  })
})
