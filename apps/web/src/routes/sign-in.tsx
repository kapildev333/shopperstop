import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Card, PageHeader } from '@shopperstop/ui'
import { safeReturnTo, searchReturnTo, signIn } from '../auth'
import { SignInForm } from '../auth-forms'

function SignIn() {
  const { returnTo } = Route.useSearch()
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sign in" />
      <Card className="mx-auto w-full max-w-md p-6">
        <SignInForm
          submit={async (values) => {
            const error = await signIn(values)
            if (!error) await navigate({ href: safeReturnTo(returnTo), replace: true })
            return error
          }}
        />
        <p className="mt-4 text-body text-ink">
          New to ShopperStop?{' '}
          <Link to="/register" search={{ returnTo }} className="text-accent underline">
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/sign-in')({
  validateSearch: searchReturnTo,
  component: SignIn,
})
