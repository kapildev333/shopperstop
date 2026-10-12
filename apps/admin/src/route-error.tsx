import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { ErrorBanner } from '@shopperstop/ui'
import { NotFound } from './not-found'

// Every route's error boundary. A 403 means the role cannot open this, so it reads as not found (Spec 2 §8);
// anything else is a load failure with a retry. 401 never lands here: the client clears the session and the guard redirects.
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  if ((error as { code?: string } | undefined)?.code === 'forbidden') return <NotFound />
  return <ErrorBanner message="Could not reach the server." onRetry={() => void router.invalidate()} />
}
