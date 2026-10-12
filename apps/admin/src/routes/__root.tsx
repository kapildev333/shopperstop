import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { PageHeader, TabNav } from '@shopperstop/ui'

function RootLayout() {
  return (
    <>
      <header>
        <div className="bg-brand px-4 py-3 text-h3 text-on-brand sm:px-6">ShopperStop Admin</div>
        <TabNav label="Admin" className="bg-surface px-4 sm:px-6">
          <Link to="/">Dashboard</Link>
        </TabNav>
      </header>
      <main className="px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </>
  )
}

function NotFound() {
  return <PageHeader title="Page not found" />
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})
