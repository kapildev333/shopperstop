import { useState } from 'react'
import { Button, ErrorBanner, StatusMessage } from '@shopperstop/ui'
import { api, call, queryClient, useMe } from './api'

// Shows while the signed-in customer has not proved their email; renders nothing while /me loads or fails.
export function VerifyEmailBanner() {
  const me = useMe()
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  if (me.data?.emailVerified !== false) return null
  if (sent) return <StatusMessage tone="success">Verification email sent</StatusMessage>

  async function onSend() {
    setPending(true)
    setError(undefined)
    const failure = await call(() => api.POST('/me/email-verification'))
    setPending(false)
    if (!failure) setSent(true)
    // Already verified: reading /me again hides the banner.
    else if (failure.code === 'conflict') await queryClient.invalidateQueries({ queryKey: ['me'] })
    else setError(failure.message)
  }

  return (
    <div className="flex flex-col gap-2">
      <StatusMessage tone="warning" className="flex-wrap">
        <span>Verify your email to pay online</span>
        <Button size="compact" loading={pending} onClick={onSend}>
          Send verification email
        </Button>
      </StatusMessage>
      {error && <ErrorBanner message={error} />}
    </div>
  )
}
