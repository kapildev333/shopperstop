import { notifyManager, useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import { StatusMessage } from '@shopperstop/ui'
import type { ApiError } from './api'

// The one notice for a read that failed while its page still shows what it loaded before: the page keeps its data
// (each page asks `data === undefined` before it shows an alert) and this says the data may be old. It reads the query
// cache, not a page: any query on screen that holds data and whose last read failed. A 404 is an answer, not a failure:
// the detail pages show "Page not found" for it. The next good answer to that query takes the notice away.
export function RefetchNotice() {
  const cache = useQueryClient().getQueryCache()
  const subscribe = useCallback((changed: () => void) => cache.subscribe(notifyManager.batchCalls(changed)), [cache])
  const failed = useSyncExternalStore(subscribe, () =>
    cache
      .findAll({ type: 'active' })
      .some(({ state }) => state.status === 'error' && state.data !== undefined && (state.error as Partial<ApiError>).code !== 'not_found'),
  )
  return failed ? <StatusMessage tone="warning" className="mb-6">Could not refresh. Showing what was loaded last.</StatusMessage> : null
}
