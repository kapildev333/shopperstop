import { createFileRoute, Navigate } from '@tanstack/react-router'
import { OrderPage } from '../order-tracking'
import { useToken } from '../session'

function Order() {
  const { id } = Route.useParams()
  const token = useToken()
  if (!token) return <Navigate to="/sign-in" search={{ returnTo: `/orders/${id}` }} replace />
  return <OrderPage id={id} />
}

export const Route = createFileRoute('/orders/$id')({
  component: Order,
})
