import { useLocalSearchParams } from 'expo-router'
import { OrderTracking } from '../../orders-tracking'

// The route reads the id; the screen does the rest.
export default function OrderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <OrderTracking id={id} />
}
