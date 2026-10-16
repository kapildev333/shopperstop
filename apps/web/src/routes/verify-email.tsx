import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, ErrorBanner, PageHeader, StatusMessage, buttonClass } from '@shopperstop/ui'
import { api, call, queryClient, type ApiError } from '../api'
import { useToken } from '../session'
import { VerifyEmailBanner } from '../verify-email-banner'

function VerifyEmail() {
  const { token } = Route.useSearch()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Verify email" />
      <Card className="mx-auto w-full max-w-md p-6">{token ? <Verifying token={token} /> : <Invalid />}</Card>
    </div>
  )
}

// Keyed by the code and never stale, so StrictMode's second mount reuses the first post instead of sending it again.
function Verifying({ token }: { token: string }) {
  const query = useQuery<boolean, ApiError>({
    queryKey: ['verify-email', token],
    staleTime: Infinity,
    queryFn: async () => {
      const error = await call(() => api.POST('/auth/verify-email', { body: { token } }))
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      return true
    },
  })
  if (query.isSuccess)
    return (
      <div className="flex flex-col gap-4">
        <StatusMessage tone="success">Your email is verified</StatusMessage>
        <Link to="/account" className={buttonClass({})}>
          Continue
        </Link>
      </div>
    )
  if (query.isError) {
    if (query.error.field === 'token') return <Invalid />
    return <ErrorBanner message={query.error.message} onRetry={() => void query.refetch()} />
  }
  return <StatusMessage>Verifying your email</StatusMessage>
}

// A code core refused or none at all: a signed-in customer can ask for a new one here, a signed-out one signs in first.
function Invalid() {
  const token = useToken()
  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner message="This verification link is invalid or has expired." />
      {token ? (
        <VerifyEmailBanner />
      ) : (
        <Link to="/sign-in" search={{ returnTo: '/account' }} className="self-start text-body text-accent underline">
          Sign in to get a new link
        </Link>
      )}
    </div>
  )
}

export const Route = createFileRoute('/verify-email')({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search.token === 'string' && search.token ? { token: search.token } : {},
  component: VerifyEmail,
})
