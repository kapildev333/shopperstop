import { createFileRoute } from '@tanstack/react-router'
import { DeliveryPage } from '../../../delivery'

function DeliveryRoute() {
  const { deliveryId } = Route.useParams()
  return <DeliveryPage deliveryId={deliveryId} />
}

export const Route = createFileRoute('/_rider/deliveries/$deliveryId')({
  component: DeliveryRoute,
})
