import { createFileRoute, redirect } from '@tanstack/react-router'
import { meQuery } from '../api'
import { getToken } from '../session'

// Guard for every protected page: no token, no request; the token but no staff member, the error boundary.
export const Route = createFileRoute('/_staff')({
  beforeLoad: async ({ context, location }) => {
    const toSignIn = () => redirect({ to: '/sign-in', search: { redirect: location.href } })
    if (!getToken()) throw toSignIn()
    try {
      return { staff: await context.queryClient.ensureQueryData(meQuery) }
    } catch (error) {
      if (!getToken()) throw toSignIn()
      throw error
    }
  },
})
