import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Card, PageHeader } from '@shopperstop/ui'
import { register, safeReturnTo, searchReturnTo } from '../auth'
import { RegisterForm } from '../auth-forms'

function Register() {
  const { returnTo } = Route.useSearch()
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Create your account" />
      <Card className="mx-auto w-full max-w-md p-6">
        <RegisterForm
          submit={async (values) => {
            const error = await register(values)
            if (!error) await navigate({ href: safeReturnTo(returnTo), replace: true })
            return error
          }}
        />
        <p className="mt-4 text-body text-ink">
          Already have an account?{' '}
          <Link to="/sign-in" search={{ returnTo }} className="text-accent underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/register')({
  validateSearch: searchReturnTo,
  component: Register,
})
