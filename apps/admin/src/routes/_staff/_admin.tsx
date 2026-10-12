import { Outlet, createFileRoute } from '@tanstack/react-router'
import { NotFound } from '../../not-found'

// Admin-only folder: store staff see the not-found page inside the shell, never the page and never a redirect.
function AdminOnly() {
  const { staff } = Route.useRouteContext()
  return staff.role === 'admin' ? <Outlet /> : <NotFound />
}

export const Route = createFileRoute('/_staff/_admin')({ component: AdminOnly })
