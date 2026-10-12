import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorBanner, FormField, Input, PageHeader } from '@shopperstop/ui'
import { api, meQuery, type ApiError } from '../api'
import { setToken } from '../session'

// Only in-app paths: `/` not followed by `/` or `\` (browsers read `/\host` like `//host`); never an absolute URL (open redirect).
function safeRedirect(value: unknown) {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : undefined
}

const messages: Partial<Record<ApiError['code'], string>> = {
  unauthorized: 'Email or password is wrong, or the account is inactive.',
  rate_limited: 'Too many sign-in attempts. Try again later.',
}

function SignIn() {
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const signIn = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/admin/auth/sign-in', { body: { email, password } })
      if (error) throw error.error
      return data
    },
    onSuccess: async ({ token, staff }) => {
      setToken(token)
      queryClient.setQueryData(meQuery.queryKey, staff)
      await navigate({ href: redirect ?? '/' })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const errors = {
      email: email.trim() ? undefined : 'Enter your email.',
      password: password ? undefined : 'Enter your password.',
    }
    setFieldErrors(errors)
    if (!errors.email && !errors.password) signIn.mutate()
  }

  // A validation error on email or password goes to its field; any other answer from core goes to the banner.
  const apiError = signIn.error && 'code' in signIn.error ? (signIn.error as ApiError) : undefined
  const serverField =
    apiError?.code === 'validation' && (apiError.field === 'email' || apiError.field === 'password') ? apiError.field : undefined
  const banner = signIn.error
    ? apiError
      ? serverField
        ? undefined
        : (messages[apiError.code] ?? 'Something went wrong. Try again.')
      : 'Could not reach the server. Check your connection and try again.'
    : undefined

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <PageHeader title="Sign in" />
      <Card className="p-6">
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {banner && <ErrorBanner message={banner} />}
          <FormField label="Email" error={fieldErrors.email ?? (serverField === 'email' ? apiError?.message : undefined)}>
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Password" error={fieldErrors.password ?? (serverField === 'password' ? apiError?.message : undefined)}>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <Button type="submit" loading={signIn.isPending}>Sign in</Button>
        </form>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({ redirect: safeRedirect(search.redirect) }),
  component: SignIn,
})
