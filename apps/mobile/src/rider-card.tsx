import { Linking, View } from 'react-native'
import { MapPin } from 'lucide-react-native'
import { statusName, statusVariant, useNow, type Order } from './orders'
import { lastSeen, mapsUrl, riderStage, useDelivery } from './rider'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Text } from './ui/text'
import { colors, radius } from './ui/tokens'

// From out for delivery on: who carries the order and where they were last seen. Nothing while no rider is known.
export function RiderCard({ order }: { order: Order }) {
  const { data: delivery } = useDelivery(order.id, order.status)
  const now = useNow()
  // The order's own rider name first; the rider read names the rider when core has none (the demo seed's delivered order).
  const name = order.riderName ?? delivery?.riderName
  if (!riderStage(order.status) || !name) return null
  const location = delivery?.location
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="h3" tone="onBrand">
            {name.charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="small" tone="inkMuted" heading={2}>
            Your rider
          </Text>
          <Text variant="h3">{name}</Text>
          {location ? (
            <Text variant="small" tone="inkMuted">
              {lastSeen(location.recordedAt, now)}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row' }}>
            <Badge variant={statusVariant(order.status)}>{statusName(order.status)}</Badge>
          </View>
        </View>
      </View>
      {location ? (
        <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
          <Button
            variant="secondary"
            size="compact"
            icon={MapPin}
            onPress={() => void Linking.openURL(mapsUrl(location.lat, location.lng))}
          >
            Open in Maps
          </Button>
        </View>
      ) : null}
    </Card>
  )
}
