import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App foundation shell', () => {
  it('renders the bootstrap status and dependency direction', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: /subject-agnostic learning interface/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/ui -> application layer -> learning core/i),
    ).toBeInTheDocument()
  })
})
