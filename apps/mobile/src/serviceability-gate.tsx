import { Clock, MapPinOff } from 'lucide-react-native'
import { Link } from 'expo-router'
import type { ComponentType, ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { openPincodeSheet } from './pincode'
import { type Store, useStore } from './serviceability'
import { Button } from './ui/button'
import { ErrorBanner } from './ui/error-banner'
import { Skeleton } from './ui/skeleton'
import { Text } from './ui/text'
import { colors, fontFamily, radius, spacing } from './ui/tokens'

type Props = { children: (store: Store) => ReactNode }

// Renders the screen's content only for an open store; every other state is a notice or the loading tiles.
export function StoreGate({ children }: Props) {
  const state = useStore()
  switch (state.kind) {
    case 'loading':
      return (
        <View style={styles.loading}>
          <Skeleton variant="tiles" columns={4} count={8} />
        </View>
      )
    case 'open':
      return <>{children(state.store)}</>
    case 'error':
      return <ErrorBanner error={state.error} onRetry={state.retry} />
    case 'none':
      return (
        <Notice
          icon={MapPinOff}
          title="Set your pincode"
          body="Choose a pincode to see the store near you and what it has in stock."
          action="Choose pincode"
        />
      )
    case 'notServiceable':
      return (
        <Notice
          icon={MapPinOff}
          title="We don't deliver here yet"
          body="ShopperStop delivers in parts of Bengaluru for now. Try another pincode."
          action="Change pincode"
        />
      )
    case 'closed':
      return (
        <Notice
          icon={Clock}
          title={`${state.store.name} store is closed`}
          body="The store for your pincode isn't taking orders right now. Orders already placed will still arrive."
          action="Change pincode"
          orders
        />
      )
  }
}

type NoticeProps = {
  icon: ComponentType<{ size?: number; color?: string }>
  title: string
  body: string
  action: string
  orders?: boolean
}

function Notice({ icon: Icon, title, body, action, orders = false }: NoticeProps) {
  return (
    <View style={styles.notice}>
      <View style={styles.badge} aria-hidden>
        <Icon size={44} color={colors.ink} />
      </View>
      <Text variant="h1" heading={2} style={styles.center}>
        {title}
      </Text>
      <Text tone="inkMuted" style={[styles.center, styles.body]}>
        {body}
      </Text>
      <View style={styles.action}>
        <Button size="lg" onPress={openPincodeSheet}>
          {action}
        </Button>
      </View>
      {orders ? (
        <Link href="/orders" asChild>
          <Pressable accessibilityRole="link" style={styles.link}>
            <Text variant="body" tone="accent" style={styles.linkText}>
              See your orders
            </Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  loading: { backgroundColor: colors.surface, padding: spacing.gutter },
  notice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.unit * 4,
    paddingVertical: spacing.unit * 8,
    paddingHorizontal: 24,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningSoft,
  },
  center: { textAlign: 'center' },
  body: { maxWidth: 300 },
  action: { marginTop: spacing.unit * 2 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: fontFamily(600) },
})
