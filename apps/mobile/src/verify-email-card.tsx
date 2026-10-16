import { useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { api, call, queryClient, useMe } from './api'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { StatusMessage } from './ui/status-message'
import { Text } from './ui/text'
import { spacing } from './ui/tokens'

// Shown on "My account" and checkout while the customer's email is unverified; nothing while /me is loading, failed or says verified.
export function VerifyEmailCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const me = useMe()
  const router = useRouter()
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  if (me.data?.emailVerified !== false) return null

  async function send() {
    setPending(true)
    setError(undefined)
    const failure = await call(() => api.POST('/me/email-verification'))
    setPending(false)
    if (!failure) setSent(true)
    // Already verified: read the customer again, so the card goes once /me says so.
    else if (failure.code === 'conflict') await queryClient.invalidateQueries({ queryKey: ['me'] })
    else setError(failure.message)
  }

  return (
    <View style={style}>
      <Card>
        <View style={styles.column}>
          {sent ? (
            <>
              <StatusMessage tone="success">Verification email sent</StatusMessage>
              <Button variant="secondary" onPress={() => router.push('/verify-email')}>
                Enter the code
              </Button>
            </>
          ) : (
            <>
              <StatusMessage tone="warning">Verify your email to pay online</StatusMessage>
              <Button variant="secondary" loading={pending} onPress={() => void send()}>
                Send verification email
              </Button>
              {error ? (
                <Text accessibilityRole="alert" tone="danger">
                  {error}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  column: { gap: spacing.unit * 3 },
})
