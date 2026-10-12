import { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { onUnauthorized, type ApiError } from './api'
import { RouteError } from './route-error'
import { routeTree } from './routeTree.gen'

export function createAppRouter(history?: RouterHistory) {
  const queryClient = new QueryClient({
    // A 403 in a page query goes to the route's error boundary, which shows not found.
    defaultOptions: { queries: { retry: false, throwOnError: (error) => (error as Partial<ApiError>).code === 'forbidden' } },
  })
  const router = createRouter({
    routeTree,
    history,
    basepath: history ? undefined : '/admin',
    context: { queryClient },
    defaultErrorComponent: RouteError,
  })
  onUnauthorized(() => {
    queryClient.clear()
    void router.invalidate()
  })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
