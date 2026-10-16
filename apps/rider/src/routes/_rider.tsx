import { createFileRoute, redirect } from '@tanstack/react-router'
import { meQuery } from '../api'
import { getToken } from '../session'

// Guard for every rider page: no token, no request; the token but no rider, the error boundary.
export const Route = createFileRoute('/_rider')({
  beforeLoad: async ({ context, location }) => {
    const toSignIn = () => redirect({ to: '/sign-in', search: { redirect: location.href } })
    if (!getToken()) throw toSignIn()
    try {
      return { rider: await context.queryClient.ensureQueryData(meQuery) }
    } catch (error) {
      if (!getToken()) throw toSignIn()
      throw error
    }
  },
})
