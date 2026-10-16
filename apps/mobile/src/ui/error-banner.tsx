import { Pressable, View } from 'react-native'
import { colors, fontFamily, radius } from './tokens'
import { Text } from './text'

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
    <View accessible accessibilityRole="alert" style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          padding: 12,
          borderRadius: radius.control,
          backgroundColor: colors.dangerSoft,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" style={{ fontFamily: fontFamily(600) }}>
            {text.title}
          </Text>
          <Text>{text.body}</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={{
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
          borderRadius: radius.control,
          backgroundColor: colors.accent,
        }}
      >
        <Text variant="button" tone="onAccent">
          Try again
        </Text>
      </Pressable>
    </View>
  )
}
