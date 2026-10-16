import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Check, ChevronLeft } from 'lucide-react-native'
import { formatInr } from '@shopperstop/ui/format'
import { headline, productCountLabel, statusMessage, timeline, underWay, useNow, useOrder, type Order, type Step } from './orders'
import { useBack } from './screen-support'
import { useToken } from './session'
import { Button, IconButton } from './ui/button'
import { Card } from './ui/card'
import { ErrorBanner } from './ui/error-banner'
import { Skeleton } from './ui/skeleton'
import { Text } from './ui/text'
import { colors, fontFamily } from './ui/tokens'

// Signed out, the screen asks to sign in and comes back to this order.
export function OrderTracking({ id }: { id: string }) {
  const token = useToken()
  if (!token) return <Redirect href={`/sign-in?returnTo=${encodeURIComponent(`/orders/${id}`)}`} />
  return <Tracking id={id} />
}

function Tracking({ id }: { id: string }) {
  const { data: order, isError, error, refetch } = useOrder(id)
  const back = useBack()
  const router = useRouter()

  // Data is checked before the error: a failed repeat keeps the order on screen.
  if (order === undefined) {
    return (
      <Frame title="Your order" back={back}>
        {isError ? (
          <>
            <ErrorBanner error={error} onRetry={() => void refetch()} />
            <Text tone="inkMuted" style={{ textAlign: 'center' }}>
              {"Your order is safe. We just couldn't load its latest status."}
            </Text>
          </>
        ) : (
          <Skeleton count={3} />
        )}
      </Frame>
    )
  }
  if (order === null) {
    return (
      <Frame title="Order not found" back={back}>
        <Text tone="inkMuted">This order is not in your account.</Text>
        <Button size="lg" onPress={() => router.navigate('/orders')}>
          Your orders
        </Button>
      </Frame>
    )
  }
  return <Content order={order} back={back} onHelp={() => router.push('/account')} />
}

// The states that have no order: a plain header and the body.
function Frame({ title, back, children }: { title: string; back: () => void; children: ReactNode }) {
  return (
    <View role="main" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Head>
        <title>{`${title} · ShopperStop`}</title>
      </Head>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View
          style={{
            height: 64,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <IconButton label="Back" icon={ChevronLeft} onPress={back} />
          <Text variant="h2" heading={1}>
            {title}
          </Text>
        </View>
      </SafeAreaView>
      <View style={{ padding: 12, gap: 12 }}>{children}</View>
    </View>
  )
}

function Content({ order, back, onHelp }: { order: Order; back: () => void; onHelp: () => void }) {
  return (
    <View role="main" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Head>
        <title>{`Order ${order.number} · ShopperStop`}</title>
      </Head>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: colors.brand }}>
          <View style={{ paddingTop: 8, paddingHorizontal: 8, paddingBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <IconButton label="Back" icon={ChevronLeft} tone="onBrand" onPress={back} />
              <Text variant="button" tone="onBrand" heading={1} tabular>
                {`Order ${order.number}`}
              </Text>
            </View>
            <View style={{ paddingTop: 8, paddingHorizontal: 12, gap: 4 }}>
              <Headline order={order} />
              {/* One element for every status, so a change is announced in place; the headline sits outside it. */}
              <Text tone="onBrand" role="status" accessibilityLiveRegion="polite" style={{ fontFamily: fontFamily(600) }}>
                {statusMessage(order)}
              </Text>
            </View>
          </View>
        </SafeAreaView>
        <View style={{ marginTop: -12, marginHorizontal: 12 }}>
          <Card>
            <Timeline order={order} />
          </Card>
        </View>
        <View style={{ marginTop: 12, marginHorizontal: 12 }}>
          <Card>
            <View style={{ gap: 8 }}>
              <Text variant="h3" heading={2}>
                {`${productCountLabel(order)} · Cash on delivery`}
              </Text>
              {order.items.map((item) => (
                <Row key={item.productId} label={`${item.quantity} × ${item.name}`} value={formatInr(item.priceCents * item.quantity)} />
              ))}
              <Row label="Delivery fee" value={order.deliveryFeeCents === 0 ? 'Free' : formatInr(order.deliveryFeeCents)} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}>
                <Text style={{ fontFamily: fontFamily(700) }}>{underWay(order.status) ? 'Pay on delivery' : 'Total'}</Text>
                <Text tabular style={{ fontFamily: fontFamily(700) }}>
                  {formatInr(order.totalCents)}
                </Text>
              </View>
            </View>
          </Card>
        </View>
        <View style={{ marginTop: 12, marginHorizontal: 12 }}>
          <Card>
            <View style={{ gap: 2 }}>
              <Text variant="h3" heading={2}>
                {underWay(order.status) ? `Delivering to ${order.address.label}` : `Address: ${order.address.label}`}
              </Text>
              <Text tone="inkMuted">{[order.address.line1, order.address.line2, order.address.pincode].filter(Boolean).join(', ')}</Text>
            </View>
          </Card>
        </View>
        <View style={{ marginTop: 12, marginHorizontal: 12 }}>
          <Button variant="ghost" onPress={onHelp}>
            Need help?
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}

// The headline counts down outside the status element, so a minute changing is not announced.
export function Headline({ order }: { order: Order }) {
  const now = useNow()
  return (
    <Text variant="display" tone="onBrand">
      {headline(order, now)}
    </Text>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text>{label}</Text>
      <Text tabular>{value}</Text>
    </View>
  )
}

function Timeline({ order }: { order: Order }) {
  const steps = timeline(order)
  return (
    <View>
      <Text variant="h3" heading={2} style={{ marginBottom: 12 }}>
        Order status
      </Text>
      {steps.map((step, i) => (
        <TimelineRow key={`${step.label}-${i}`} step={step} last={i === steps.length - 1} />
      ))}
    </View>
  )
}

function TimelineRow({ step, last }: { step: Step; last: boolean }) {
  const done = step.state === 'done'
  const current = step.state === 'current'
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 20, alignItems: 'center' }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: done ? colors.accent : colors.surface,
            borderColor: done || current ? colors.accent : colors.lineStrong,
          }}
        >
          {done ? <Check size={12} color={colors.onAccent} strokeWidth={3.5} /> : null}
        </View>
        {last ? null : <View style={{ width: 2, flex: 1, minHeight: 20, backgroundColor: done ? colors.accent : colors.line }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: 14 }}>
        <Text
          tone={step.state === 'future' ? 'inkMuted' : 'ink'}
          style={current ? { fontFamily: fontFamily(700) } : undefined}
        >
          {step.label}
        </Text>
        {step.time ? (
          <Text variant="small" tone="inkMuted" tabular>
            {step.time}
          </Text>
        ) : null}
        {step.actor ? (
          <Text variant="small" tone="inkMuted">
            {step.actor}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
