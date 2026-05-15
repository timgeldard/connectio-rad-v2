import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EnvMonWorkspace } from './envmon-workspace.js'
import type { ScopeContext } from '@connectio/data-contracts'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  })
}

const testScope: ScopeContext = {
  plantId: 'IE10',
  regionId: 'EU-WEST',
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

describe('EnvMonWorkspace', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <Wrapper>
        <EnvMonWorkspace scope={testScope} />
      </Wrapper>
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('renders the workspace display name', async () => {
    render(
      <Wrapper>
        <EnvMonWorkspace scope={testScope} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.queryByText('Environmental Monitoring')).not.toBeNull()
    })
  })

  it('renders the scope-overview view by default', async () => {
    render(
      <Wrapper>
        <EnvMonWorkspace scope={testScope} />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-envmon-site-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the alerts view when viewId is alerts', async () => {
    render(
      <Wrapper>
        <EnvMonWorkspace scope={testScope} viewId="alerts" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-envmon-alerts"]')
      expect(panel).not.toBeNull()
    })
  })

  it('falls back to scope-overview for unknown viewId', async () => {
    render(
      <Wrapper>
        <EnvMonWorkspace scope={testScope} viewId="nonexistent-view" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-envmon-site-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the actions sidebar', async () => {
    render(
      <Wrapper>
        <EnvMonWorkspace scope={testScope} />
      </Wrapper>
    )

    await waitFor(() => {
      const sidebar = screen.queryByLabelText('Environmental monitoring actions')
      expect(sidebar).not.toBeNull()
    })
  })
})
