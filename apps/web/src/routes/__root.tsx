import { Outlet, createLink, createRootRoute } from '@tanstack/react-router'
import { Button, ButtonLink, Card, EmptyState, PageHeader } from '@shopperstop/ui'
import { MapPin } from 'lucide-react'

const RouterButtonLink = createLink(ButtonLink)

function RootLayout() {
  return (
    <>
      <header className="flex items-center justify-between gap-4 bg-brand px-4 py-3 sm:px-6">
        <div className="text-h2 text-on-brand">ShopperStop</div>
        <Button variant="secondary">
          <MapPin size={16} aria-hidden />
          Enter pincode
        </Button>
      </header>
      <main className="px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </>
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
