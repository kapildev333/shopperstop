import { createLink, useLocation } from '@tanstack/react-router'
import { ButtonLink } from '@shopperstop/ui'
import { UserRound } from 'lucide-react'
import { useMe } from './api'
import { useToken } from './session'

const RouterButtonLink = createLink(ButtonLink)

// Banner control: "Sign in" when signed out, the customer's name when signed in.
export function AccountLink() {
  const token = useToken()
  const me = useMe()
  const location = useLocation()
  if (!token) {
    const onAuthPage = location.pathname === '/sign-in' || location.pathname === '/register'
    const returnTo = onAuthPage ? (location.search as { returnTo?: string }).returnTo : location.href
    return (
      <RouterButtonLink variant="secondary" to="/sign-in" search={returnTo ? { returnTo } : {}}>
        Sign in
      </RouterButtonLink>
    )
  }
  return (
    <RouterButtonLink variant="secondary" to="/account">
      <UserRound size={16} aria-hidden />
      <span className="max-sm:sr-only">{me.data?.name ?? 'Account'}</span>
    </RouterButtonLink>
  )
}
