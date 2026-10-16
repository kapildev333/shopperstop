import { useCallback, useRef } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ReceiptText } from 'lucide-react-native'
import { formatInr } from '@shopperstop/ui/format'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { EmptyState } from '../../ui/empty-state'
import { ErrorBanner } from '../../ui/error-banner'
import { Skeleton } from '../../ui/skeleton'
import { Text } from '../../ui/text'
import { colors, radius, shadows } from '../../ui/tokens'
import { useToken } from '../../session'
import { itemCountLabel, placedLabel, statusName, statusVariant, useNow, useOrders, type Order } from '../../orders'

// Tabs stay mounted, so every focus after the first reads the list again; a failed read keeps what is held.
export default function Orders() {
  const token = useToken()
  const router = useRouter()
  const { data, error, isError, refetch } = useOrders()
  const now = useNow()
  const mounted = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (!token) return
      if (!mounted.current) {
        mounted.current = true
        return
      }
      void refetch()
    }, [token, refetch]),
  )

  let body
  if (!token) {
    body = (
      <EmptyState
        title="Sign in to see your orders"
        action={
          <Button size="lg" onPress={() => router.push('/sign-in?returnTo=%2Forders')}>
            Sign in
          </Button>
        }
      />
    )
  } else if (data) {
    body =
      data.items.length === 0 ? (
        <View style={{ paddingTop: 120 }}>
          <EmptyState
            title="No orders yet"
            description="Your past and current orders show up here."
            icon={
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: radius.pill,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ReceiptText size={40} color={colors.ink} />
              </View>
            }
            action={
              <Button size="lg" onPress={() => router.navigate('/')}>
                Start shopping
              </Button>
            }
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
          {data.items.map((order) => (
            <OrderCard key={order.id} order={order} now={now} onOpen={() => router.push(`/orders/${order.id}`)} />
          ))}
          {data.total > data.items.length ? (
            <Text variant="small" tone="inkMuted" style={{ textAlign: 'center' }}>
              {`Showing your latest ${data.items.length} orders.`}
            </Text>
          ) : null}
        </ScrollView>
      )
  } else if (isError) {
    body = (
      <View style={{ padding: 12 }}>
        <ErrorBanner error={error} onRetry={() => void refetch()} />
      </View>
    )
  } else {
    body = (
      <View style={{ padding: 12 }}>
        <Skeleton count={3} />
      </View>
    )
  }

  return (
    <View role="main" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Head>
        <title>Your orders · ShopperStop</title>
      </Head>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={{ height: 64, justifyContent: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Text variant="h2" heading={1}>
            Your orders
          </Text>
        </View>
      </SafeAreaView>
      {body}
    </View>
  )
}

function OrderCard({ order, now, onOpen }: { order: Order; now: number; onOpen: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[
        `View order ${order.number}`,
        statusName(order.status),
        `${placedLabel(order.placedAt, now)} · ${itemCountLabel(order)}`,
        formatInr(order.totalCents),
      ].join(', ')}
      onPress={onOpen}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        padding: 14,
        gap: 10,
        minHeight: 44,
        boxShadow: shadows.card.boxShadow,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text variant="button" tabular>
          {order.number}
        </Text>
        <Badge variant={statusVariant(order.status)}>{statusName(order.status)}</Badge>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text tone="inkMuted" tabular>
          {`${placedLabel(order.placedAt, now)} · ${itemCountLabel(order)}`}
        </Text>
        <Text variant="button" tabular>
          {formatInr(order.totalCents)}
        </Text>
      </View>
    </Pressable>
  )
}
