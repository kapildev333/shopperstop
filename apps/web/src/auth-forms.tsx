import { useState, type FormEvent } from 'react'
import { Button, ErrorBanner, FormField, Input } from '@shopperstop/ui'
import { splitError, type ApiError } from './api'

type Errors = { fields: Record<string, string>; banner?: string }

const none: Errors = { fields: {} }

function text(form: FormData, name: string) {
  return String(form.get(name) ?? '')
}

export function SignInForm({
  submit,
}: {
  submit: (values: { email: string; password: string }) => Promise<ApiError | undefined>
}) {
  const [errors, setErrors] = useState<Errors>(none)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = { email: text(form, 'email').trim(), password: text(form, 'password') }
    const fields: Record<string, string> = {}
    if (!values.email) fields.email = 'Enter your email'
    if (!values.password) fields.password = 'Enter your password'
    if (Object.keys(fields).length > 0) return setErrors({ fields })
    setPending(true)
    const error = await submit(values)
    setPending(false)
    setErrors(splitError(error, ['email', 'password']))
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField label="Email" error={errors.fields.email}>
        <Input name="email" type="email" autoComplete="email" />
      </FormField>
      <FormField label="Password" error={errors.fields.password}>
        <Input name="password" type="password" autoComplete="current-password" />
      </FormField>
      {errors.banner && <ErrorBanner message={errors.banner} />}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Sign in
      </Button>
    </form>
  )
}

export function RegisterForm({
  submit,
}: {
  submit: (values: { name: string; email: string; password: string }) => Promise<ApiError | undefined>
}) {
  const [errors, setErrors] = useState<Errors>(none)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      name: text(form, 'name').trim(),
      email: text(form, 'email').trim(),
      password: text(form, 'password'),
    }
    const fields: Record<string, string> = {}
    if (!values.name) fields.name = 'Enter your name'
    if (!values.email) fields.email = 'Enter your email'
    // Core counts the password in bytes, not characters.
    const bytes = new TextEncoder().encode(values.password).length
    if (!values.password) fields.password = 'Enter your password'
    else if (bytes < 8 || bytes > 72) fields.password = 'Use 8 to 72 characters'
    if (Object.keys(fields).length > 0) return setErrors({ fields })
    setPending(true)
    const error = await submit(values)
    setPending(false)
    setErrors(splitError(error, ['name', 'email', 'password']))
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField label="Name" error={errors.fields.name}>
        <Input name="name" autoComplete="name" />
      </FormField>
      <FormField label="Email" error={errors.fields.email}>
        <Input name="email" type="email" autoComplete="email" />
      </FormField>
      <FormField label="Password" hint="8 to 72 characters" error={errors.fields.password}>
        <Input name="password" type="password" autoComplete="new-password" />
      </FormField>
      {errors.banner && <ErrorBanner message={errors.banner} />}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Create account
      </Button>
    </form>
  )
}
