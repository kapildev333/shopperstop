import { useRouter } from '@tanstack/react-router'
import { ErrorBanner } from '@shopperstop/ui'

// Every route's error boundary: a failed load shows the retry. 401 never lands here: the client clears the session and the guard redirects.
export function RouteError() {
  const router = useRouter()
  return <ErrorBanner message="Could not reach the server." onRetry={() => void router.invalidate()} />
}
