import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'
import { deliveryQuery, type ApiError } from '../../../api'
import { NotFound } from '../../../not-found'

// The delivery's page comes with its own task; here, the order's number and the not-found answer.
function DeliveryPage() {
  const { deliveryId } = Route.useParams()
  const delivery = useQuery(deliveryQuery(deliveryId))
  if (delivery.error) {
    if ((delivery.error as Partial<ApiError>).code === 'not_found') return <NotFound />
    throw delivery.error
  }
  if (!delivery.data) return null
  return <PageHeader title={`Order ${delivery.data.orderNumber}`} />
}

export const Route = createFileRoute('/_rider/deliveries/$deliveryId')({
  component: DeliveryPage,
})
