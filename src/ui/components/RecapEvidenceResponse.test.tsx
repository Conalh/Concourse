import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { RecapResponse } from '../../application'
import { OptionIdSchema } from '../../core/contracts'
import { RecapEvidenceResponse } from './RecapEvidenceResponse'

function renderResponse(response: RecapResponse) {
  render(<RecapEvidenceResponse response={response} />)
}

describe('RecapEvidenceResponse', () => {
  it('renders text, number, confidence, code, and manual responses', () => {
    renderResponse({ kind: 'text', value: 'do not release' })
    expect(screen.getByText('do not release')).toBeInTheDocument()

    renderResponse({ kind: 'number', value: 42 })
    expect(screen.getByText('42')).toBeInTheDocument()

    renderResponse({ kind: 'confidence', value: 4 })
    expect(screen.getByText('4')).toBeInTheDocument()

    renderResponse({
      kind: 'code',
      language: 'ts',
      source: 'const allowed = false',
    })
    expect(screen.getByText('const allowed = false')).toBeInTheDocument()

    renderResponse({ kind: 'manual', completed: true })
    expect(screen.getByText('Completed manually')).toBeInTheDocument()
  })

  it('renders selected choice labels without answer-key metadata or choice IDs', () => {
    const { rerender } = render(
      <RecapEvidenceResponse
        response={{
          kind: 'single-choice',
          optionId: OptionIdSchema.parse('option-false'),
          optionLabel: 'false',
        }}
      />,
    )

    expect(screen.getByText('false')).toBeInTheDocument()
    expect(screen.queryByText('option-false')).not.toBeInTheDocument()

    rerender(
      <RecapEvidenceResponse
        response={{
          kind: 'multiple-choice',
          options: [
            {
              optionId: OptionIdSchema.parse('option-true'),
              optionLabel: 'true',
            },
            {
              optionId: OptionIdSchema.parse('option-false'),
              optionLabel: 'false',
            },
          ],
        }}
      />,
    )

    expect(screen.getByText('true')).toBeInTheDocument()
    expect(screen.getByText('false')).toBeInTheDocument()
    expect(screen.queryByText('option-true')).not.toBeInTheDocument()
    expect(screen.queryByText('correctOptionIds')).not.toBeInTheDocument()
  })
})
