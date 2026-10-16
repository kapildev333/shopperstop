import { CircleAlert } from 'lucide-react-native'
import { StyleSheet, View } from 'react-native'
import { Button } from './button'
import { Text } from './text'
import { colors, fontFamily, radius, spacing } from './tokens'

// A thrown read (the network refused) is an Error; core's answers are envelopes with a string code.
export function errorKind(error: unknown): 'offline' | 'server' {
  return typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string'
    ? 'server'
    : 'offline'
}

const copy = {
  offline: { title: "You're offline", body: 'Check your connection and try again.' },
  server: { title: 'Something went wrong on our side', body: 'Please try again in a moment.' },
} as const

type Props = { error: unknown; onRetry: () => void }

export function ErrorBanner({ error, onRetry }: Props) {
  const text = copy[errorKind(error)]
  return (
    <View accessible accessibilityRole="alert" style={styles.stack}>
      <View style={styles.banner}>
        <View aria-hidden>
          <CircleAlert size={20} color={colors.danger} />
        </View>
        <View style={styles.text}>
          <Text variant="body" style={styles.title}>
            {text.title}
          </Text>
          <Text>{text.body}</Text>
        </View>
      </View>
      <Button variant="primary" size="md" onPress={onRetry}>
        Try again
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: spacing.unit * 2 },
  banner: {
    flexDirection: 'row',
    gap: spacing.gridGap,
    padding: spacing.unit * 3,
    borderRadius: radius.control,
    backgroundColor: colors.dangerSoft,
  },
  text: { flex: 1, gap: spacing.unit },
  title: { fontFamily: fontFamily(600) },
})
