import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthScopeProvider } from '@connectio/auth-scope'
import { ShellLayout } from './shell/ShellLayout.js'
import { useManifestHydration } from './registry/useManifestHydration.js'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
})

/** Inner tree — consumes providers already mounted above. */
function AppInner() {
  useManifestHydration()
  return <ShellLayout />
}

/** Root application component. Mounts all top-level providers in dependency order. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthScopeProvider>
        <AppInner />
      </AuthScopeProvider>
    </QueryClientProvider>
  )
}