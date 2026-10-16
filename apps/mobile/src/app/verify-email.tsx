import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react-native'
import { api, call, queryClient, type ApiError } from '../api'
import { useBack } from '../screen-support'
import { useToken } from '../session'
import { Button, IconButton } from '../ui/button'
import { Card } from '../ui/card'
import { FormField } from '../ui/form-field'
import { StatusMessage } from '../ui/status-message'
import { Text } from '../ui/text'
import { colors, fontFamily, spacing } from '../ui/tokens'
import { VerifyEmailCard } from '../verify-email-card'

// Reached from the mail's link (`?token=`) or from the card's "Enter the code" (typed). The code is read each render, never copied at mount.
export default function VerifyEmail() {
  const { token } = useLocalSearchParams<{ token?: string }>()
  const router = useRouter()
  const back = useBack()
  const held = useToken()
  const [typed, setTyped] = useState('')
  const [entered, setEntered] = useState<string>()
  const [fieldError, setFieldError] = useState<string>()
  const code = entered ?? (token || undefined)

  // Keyed by the code and never stale: the code is spent on first use, so a second post would only be refused.
  const verify = useQuery<true, ApiError>({
    queryKey: ['verify-email', code],
    enabled: !!code,
    staleTime: Infinity,
    queryFn: async (): Promise<true> => {
      const failure = await call(() => api.POST('/auth/verify-email', { body: { token: code as string } }))
      if (failure) throw failure
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      return true
    },
  })

  function submit() {
    const next = typed.trim()
    if (!next) {
      setFieldError('Enter the code from the email')
      return
    }
    setFieldError(undefined)
    setEntered(next)
  }

  const form = (
    <>
      <FormField
        label="Code from the email"
        value={typed}
        onChangeText={setTyped}
        error={fieldError}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="one-time-code"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button size="lg" onPress={submit}>
        Verify email
      </Button>
    </>
  )

  let body = form
  if (verify.isSuccess) {
    body = (
      <>
        <StatusMessage tone="success">Your email is verified</StatusMessage>
        <Button size="lg" onPress={() => router.replace('/account')}>
          Continue
        </Button>
      </>
    )
  } else if (code && verify.isPending) {
    body = <StatusMessage>Verifying your email</StatusMessage>
  } else if (verify.error?.field === 'token') {
    body = (
      <>
        <Text accessibilityRole="alert" tone="danger">
          This code is invalid or has expired.
        </Text>
        {held ? (
          <VerifyEmailCard />
        ) : (
          <Link href="/sign-in?returnTo=%2Faccount" style={[styles.link, styles.linkRow]}>
            Sign in to get a new code
          </Link>
        )}
        {form}
      </>
    )
  } else if (verify.error) {
    body = (
      <>
        <Text accessibilityRole="alert" tone="danger">
          {verify.error.message}
        </Text>
        <Button variant="secondary" size="lg" onPress={() => void verify.refetch()}>
          Try again
        </Button>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Verify email · ShopperStop</title>
      </Head>
      <View role="main" style={styles.screen}>
        <View style={styles.header}>
          <IconButton label="Back" icon={ChevronLeft} onPress={back} />
          <Text variant="h2" heading={1}>
            Verify email
          </Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Card>
            <View style={styles.column}>{body}</View>
          </Card>
        </ScrollView>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit,
    height: 64,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  content: { padding: 12, paddingBottom: 32, gap: 12 },
  column: { gap: spacing.unit * 3 },
  link: { color: colors.accent, fontFamily: fontFamily(600), lineHeight: 20 },
  linkRow: { alignSelf: 'flex-start', paddingVertical: 12 },
})
