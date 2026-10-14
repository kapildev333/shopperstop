import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Link, Outlet, createRootRouteWithContext, useMatch, useNavigate } from '@tanstack/react-router'
import { Button, TabNav } from '@shopperstop/ui'
import { api } from '../api'
import { navLinks } from '../nav'
import { NotFound } from '../not-found'
import { RefetchNotice } from '../refetch-notice'
import { clearToken } from '../session'

function RootLayout() {
  // Staff exists only while a guarded route is matched; the guard loaded it.
  const staff = useMatch({ from: '/_staff', shouldThrow: false })?.context.staff
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function signOut() {
    await api.POST('/admin/auth/sign-out').catch(() => undefined)
    clearToken()
    queryClient.clear()
    await navigate({ to: '/sign-in' })
  }

  return (
    <>
      <header>
        <div className="flex items-center justify-between gap-4 bg-brand px-4 py-3 text-on-brand sm:px-6">
          <span className="text-h3">ShopperStop Admin</span>
          {staff && (
            <div className="flex items-center gap-3">
              <span className="text-body">{staff.name}</span>
              <Button variant="secondary" onClick={signOut}>Sign out</Button>
            </div>
          )}
        </div>
        {staff && (
          <TabNav label="Admin" className="bg-surface px-4 sm:px-6">
            {navLinks(staff.role).map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
          </TabNav>
        )}
      </header>
      <main className="px-4 py-6 sm:px-6">
        <RefetchNotice />
        <Outlet />
      </main>
    </>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})
