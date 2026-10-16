import { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { onUnauthorized } from './api'
import { RouteError } from './route-error'
import { routeTree } from './routeTree.gen'

export function createAppRouter(history?: RouterHistory) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree,
    history,
    basepath: history ? undefined : '/rider',
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
