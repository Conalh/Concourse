import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  ContentBlockSchema,
  ExtensionKeySchema,
  type ContentBlock,
} from '../../core/contracts'
import { ContentBlockRenderer } from './ContentBlockRenderer'

function block(input: unknown): ContentBlock {
  return ContentBlockSchema.parse(input)
}

describe('ContentBlockRenderer', () => {
  it('renders every standard content block without exposing extension payloads', () => {
    render(
      <ContentBlockRenderer
        blocks={[
          block({ kind: 'text', body: 'First paragraph\nSecond paragraph' }),
          block({
            kind: 'code',
            language: 'ts',
            source: 'const value = false',
            highlightedLines: [1],
            caption: 'Boolean assignment',
          }),
          block({
            kind: 'equation',
            expression: 'A && B',
            description: 'Both sides must be true.',
          }),
          block({
            kind: 'callout',
            purpose: 'mental-model',
            title: 'Switch model',
            body: 'A Boolean is either on or off.',
          }),
          block({
            kind: 'comparison',
            items: [
              { label: 'AND', body: 'Requires both.' },
              { label: 'OR', body: 'Allows either.' },
            ],
          }),
          block({
            kind: 'question',
            prompt: 'What should this evaluate to?',
            supportingText: 'Use the expression above.',
          }),
          block({
            kind: 'extension',
            rendererKey: ExtensionKeySchema.parse('logic-basics.custom'),
            payload: { secret: 'hidden payload' },
          }),
        ]}
      />,
    )

    expect(screen.getByText('First paragraph')).toBeInTheDocument()
    expect(screen.getByText('const value = false')).toBeInTheDocument()
    expect(screen.getByText('Boolean assignment')).toBeInTheDocument()
    expect(screen.getByText('A && B')).toBeInTheDocument()
    expect(screen.getByText('Mental model')).toBeInTheDocument()
    expect(screen.getByText('AND')).toBeInTheDocument()
    expect(
      screen.getByText('What should this evaluate to?'),
    ).toBeInTheDocument()
    expect(screen.getByText('logic-basics.custom')).toBeInTheDocument()
    expect(screen.queryByText(/hidden payload/i)).not.toBeInTheDocument()
  })
})
