/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SPCConsumerWorkspace } from './spc-consumer-workspace.js'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

describe('SPCConsumerWorkspace', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders landing search screen by default', () => {
    render(
      <Wrapper>
        <SPCConsumerWorkspace />
      </Wrapper>
    )

    expect(screen.getByPlaceholderText(/Search material description/i)).not.toBeNull()
    expect(screen.getByText('Statistical Process Control')).not.toBeNull()
  })

  it('allows entering search term and finding suggestions', async () => {
    render(
      <Wrapper>
        <SPCConsumerWorkspace />
      </Wrapper>
    )

    const input = screen.getByPlaceholderText(/Search material description/i)
    fireEvent.change(input, { target: { value: 'MAT' } })

    const form = input.closest('form')
    if (form) fireEvent.submit(form)

    // Should progress to the wizard selections
    expect(screen.getByText(/Select Material:/i)).not.toBeNull()
  })
})
