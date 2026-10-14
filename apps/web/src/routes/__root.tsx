import { QueryClientProvider } from '@tanstack/react-query'
import { Link, Outlet, createLink, createRootRoute } from '@tanstack/react-router'
import { ButtonLink, Card, EmptyState, PageHeader } from '@shopperstop/ui'
import { queryClient } from '../api'
import { CartBar, CartButton, CartSheet } from '../cart-drawer'
import { AccountLink } from '../account-link'
import { StoreChangeDialog } from '../store-change'
import { PincodeButton, PincodeSheet } from '../pincode-sheet'
import { SearchForm } from '../search-form'

const RouterButtonLink = createLink(ButtonLink)

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-brand px-4 py-3 sm:px-6">
        <Link to="/" className="text-h2 text-on-brand">
          ShopperStop
        </Link>
        <SearchForm className="order-last basis-full sm:order-none sm:basis-auto sm:max-w-xl sm:flex-1" />
        <div className="ml-auto flex items-center gap-2">
          <CartButton />
          <PincodeButton />
          <AccountLink />
        </div>
      </header>
      <main className="px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      <CartBar />
      <CartSheet />
      <PincodeSheet />
      <StoreChangeDialog />
    </QueryClientProvider>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Page not found" />
      <Card className="p-6">
        <EmptyState
          title="Nothing at this address"
          description="The link may be old or mistyped."
          action={<RouterButtonLink to="/">Go to Home</RouterButtonLink>}
        />
      </Card>
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})
