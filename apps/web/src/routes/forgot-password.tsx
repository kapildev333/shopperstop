import { useState, type FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button, Card, ErrorBanner, FormField, Input, PageHeader, StatusMessage } from '@shopperstop/ui'
import { api, call, splitError } from '../api'

type Errors = { fields: Record<string, string>; banner?: string }

function ForgotPassword() {
  const [errors, setErrors] = useState<Errors>({ fields: {} })
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    if (!email) return setErrors({ fields: { email: 'Enter your email' } })
    setPending(true)
    const error = await call(() => api.POST('/auth/password-reset', { body: { email } }))
    setPending(false)
    if (error) return setErrors(splitError(error, ['email']))
    // Core answers the same for every address, so the page does too.
    setSent(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Forgot password" />
      <Card className="mx-auto w-full max-w-md p-6">
        {sent ? (
          <StatusMessage tone="success">If that email has an account, a reset link is on its way</StatusMessage>
        ) : (
          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
            <FormField label="Email" error={errors.fields.email}>
              <Input name="email" type="email" autoComplete="email" />
            </FormField>
            {errors.banner && <ErrorBanner message={errors.banner} />}
            <Button type="submit" size="lg" loading={pending} className="w-full">
              Send reset link
            </Button>
          </form>
        )}
        <p className="mt-4 text-body text-ink">
          <Link to="/sign-in" className="text-accent underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPassword,
})
