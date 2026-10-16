import { useState, type FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { buttonClass, Button, Card, ErrorBanner, FormField, Input, PageHeader, StatusMessage } from '@shopperstop/ui'
import { api, call, queryClient, splitError } from '../api'
import { setToken } from '../session'

type Errors = { fields: Record<string, string>; banner?: string }

const none: Errors = { fields: {} }
const expired = 'This reset link is invalid or has expired.'

function ResetPassword() {
  const { token } = Route.useSearch()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reset password" />
      <Card className="mx-auto w-full max-w-md p-6">{token ? <ResetForm token={token} /> : <BadCode />}</Card>
    </div>
  )
}

function RequestNewLink() {
  return (
    <Link to="/forgot-password" className="self-start text-body text-accent underline">
      Request a new link
    </Link>
  )
}

// No code in the URL: nothing to send, so no form.
function BadCode() {
  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner message={expired} />
      <RequestNewLink />
    </div>
  )
}

function ResetForm({ token }: { token: string }) {
  const [errors, setErrors] = useState<Errors>(none)
  const [pending, setPending] = useState(false)
  const [badCode, setBadCode] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    const confirm = String(form.get('confirm') ?? '')
    const fields: Record<string, string> = {}
    // Core counts the password in bytes, not characters.
    const bytes = new TextEncoder().encode(password).length
    if (!password) fields.password = 'Enter a new password'
    else if (bytes < 8 || bytes > 72) fields.password = 'Use 8 to 72 characters'
    if (confirm !== password) fields.confirm = 'Passwords do not match'
    if (Object.keys(fields).length > 0) return setErrors({ fields })
    setPending(true)
    const error = await call(() => api.POST('/auth/password-reset/confirm', { body: { token, password } }))
    setPending(false)
    if (!error) {
      // The reset signs nobody in: drop any held session and the data it fetched.
      setToken(undefined)
      queryClient.clear()
      return setDone(true)
    }
    if (error.field === 'token') return setBadCode(true)
    setErrors(splitError(error, ['password']))
  }

  if (done)
    return (
      <div className="flex flex-col gap-4">
        <StatusMessage tone="success">Your password is changed. Sign in with your new password.</StatusMessage>
        <Link to="/sign-in" className={buttonClass({})}>
          Sign in
        </Link>
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      {badCode && (
        <>
          <ErrorBanner message={expired} />
          <RequestNewLink />
        </>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="New password" hint="8 to 72 characters" error={errors.fields.password}>
          <Input name="password" type="password" autoComplete="new-password" />
        </FormField>
        <FormField label="Confirm password" error={errors.fields.confirm}>
          <Input name="confirm" type="password" autoComplete="new-password" />
        </FormField>
        {errors.banner && <ErrorBanner message={errors.banner} />}
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Set password
        </Button>
      </form>
    </div>
  )
}

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search.token === 'string' && search.token ? { token: search.token } : {},
  component: ResetPassword,
})
