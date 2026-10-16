import { Link } from 'expo-router'
import Head from 'expo-router/head'
import { View } from 'react-native'
import { EmptyState } from '../ui/empty-state'
import { Text } from '../ui/text'
import { colors } from '../ui/tokens'

export default function NotFound() {
  return (
    <View role="main" style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.canvas }}>
      <Head>
        <title>Page not found · ShopperStop</title>
      </Head>
      <EmptyState
        title="Page not found"
        action={
          <Link href="/" accessibilityRole="link" style={{ padding: 8 }}>
            <Text variant="button" tone="accent">
              Go to Home
            </Text>
          </Link>
        }
      />
    </View>
  )
}
