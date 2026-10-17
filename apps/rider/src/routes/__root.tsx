import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Link, Outlet, createRootRouteWithContext, useMatch, useNavigate } from '@tanstack/react-router'
import { Button, TabNav } from '@shopperstop/ui'
import { rider, storeQuery } from '../api'
import { riderLinks } from '../nav'
import { NotFound } from '../not-found'
import { clearToken } from '../session'
import { Availability, OfferSheet } from '../dispatch'

// The store's name, read from core. A pending or failed read shows no name and blocks nothing.
function StoreName({ storeId }: { storeId: string }) {
  const store = useQuery(storeQuery(storeId))
  return store.data ? <span className="text-small">{store.data.name}</span> : null
}

function RootLayout() {
  // The rider exists only while a guarded route is matched; the guard loaded it.
  const me = useMatch({ from: '/_rider', shouldThrow: false })?.context.rider
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function signOut() {
    await rider.POST('/auth/sign-out').catch(() => undefined)
    clearToken()
    queryClient.clear()
    await navigate({ to: '/sign-in' })
  }

  return (
    <>
      <header>
        <div className="bg-brand text-on-brand">
          <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
            <span className="text-h3">ShopperStop Rider</span>
            {me && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <StoreName storeId={me.storeId} />
                <span className="text-body">{me.name}</span>
                <Availability />
                <Button variant="secondary" onClick={signOut}>Sign out</Button>
              </div>
            )}
          </div>
        </div>
        {me && (
          <TabNav label="Rider" className="mx-auto max-w-xl bg-surface px-4">
            {riderLinks.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
          </TabNav>
        )}
      </header>
      <main className="mx-auto max-w-xl px-4 py-6">
        {me && <OfferSheet />}
        <Outlet />
      </main>
    </>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})
