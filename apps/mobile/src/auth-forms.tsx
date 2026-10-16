import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native'
import { Button, IconButton } from './ui/button'
import { FormField } from './ui/form-field'
import { Text } from './ui/text'
import { colors, fontFamily, radius } from './ui/tokens'
import { register, safeReturnTo, signIn } from './auth'
import { splitError, useBack, type Errors } from './screen-support'

const minBytes = 8
const maxBytes = 72

function Back({ label, onBack }: { label: string; onBack: () => void }) {
  return <IconButton label={label} icon={ChevronLeft} tone="onBrand" onPress={onBack} />
}

function Alert({ message }: { message: string }) {
  return (
    <View accessible accessibilityRole="alert" style={styles.alert}>
      <Text>{message}</Text>
    </View>
  )
}

function SwitchLink({ prefix, label, href }: { prefix: string; label: string; href: { pathname: string; params?: Record<string, string> } }) {
  return (
    <Text tone="inkMuted" style={styles.center}>
      {prefix}
      <Link href={href} style={styles.link}>
        {label}
      </Link>
    </Text>
  )
}

export function SignInScreen() {
  const back = useBack()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [errors, setErrors] = useState<Errors>({ fields: {} })
  const [pending, setPending] = useState(false)

  async function submit() {
    const problems: Record<string, string> = {}
    if (!email.trim()) problems.email = 'Enter your email'
    if (!password) problems.password = 'Enter your password'
    if (Object.keys(problems).length) return setErrors({ fields: problems })
    setErrors({ fields: {} })
    setPending(true)
    const error = await signIn({ email: email.trim(), password })
    if (error) {
      setPending(false)
      return setErrors(splitError(error, ['email', 'password']))
    }
    router.replace(safeReturnTo(returnTo))
  }

  return (
    <View role="main" style={styles.screen}>
      <Head>
        <title>Sign in · ShopperStop</title>
      </Head>
      <View style={styles.brand}>
        <Back label="Back" onBack={back} />
        <View style={styles.titleBlock}>
          <Text variant="display" tone="onBrand" heading={1}>
            Sign in
          </Text>
          <Text tone="onBrand">Sign in to place your order. Your cart stays as it is.</Text>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
        {errors.banner ? <Alert message={errors.banner} /> : null}
        <FormField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={errors.fields.email}
        />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!shown}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={errors.fields.password}
          trailing={
            <IconButton
              label={shown ? 'Hide password' : 'Show password'}
              icon={shown ? EyeOff : Eye}
              tone="inkMuted"
              onPress={() => setShown(!shown)}
            />
          }
        />
        <Button size="lg" loading={pending} onPress={submit}>
          Sign in
        </Button>
        <SwitchLink
          prefix="New to ShopperStop? "
          label="Create an account"
          href={{ pathname: '/register', params: returnTo === undefined ? undefined : { returnTo } }}
        />
      </ScrollView>
    </View>
  )
}

export function RegisterScreen() {
  const back = useBack()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [errors, setErrors] = useState<Errors>({ fields: {} })
  const [pending, setPending] = useState(false)

  async function submit() {
    const problems: Record<string, string> = {}
    if (!name.trim()) problems.name = 'Enter your name'
    if (!email.trim()) problems.email = 'Enter your email'
    if (!password) problems.password = 'Enter your password'
    else {
      // Length is counted in bytes, the unit core checks.
      const bytes = new TextEncoder().encode(password).length
      if (bytes < minBytes || bytes > maxBytes) problems.password = `Use ${minBytes} to ${maxBytes} characters`
    }
    if (Object.keys(problems).length) return setErrors({ fields: problems })
    setErrors({ fields: {} })
    setPending(true)
    const error = await register({ name: name.trim(), email: email.trim(), password })
    if (error) {
      setPending(false)
      return setErrors(splitError(error, ['name', 'email', 'password']))
    }
    router.replace(safeReturnTo(returnTo))
  }

  return (
    <View role="main" style={styles.screen}>
      <Head>
        <title>Create account · ShopperStop</title>
      </Head>
      <View style={[styles.brand, styles.brandRegister]}>
        <Back label="Back to sign in" onBack={back} />
        <View style={styles.titleBlock}>
          <Text variant="display" tone="onBrand" heading={1}>
            Create account
          </Text>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
        {errors.banner ? <Alert message={errors.banner} /> : null}
        <FormField
          label="Name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          error={errors.fields.name}
        />
        <FormField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={errors.fields.email}
        />
        <FormField
          label="Password"
          hint="At least 8 characters."
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!shown}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={errors.fields.password}
          trailing={
            <IconButton
              label={shown ? 'Hide password' : 'Show password'}
              icon={shown ? EyeOff : Eye}
              tone="inkMuted"
              onPress={() => setShown(!shown)}
            />
          }
        />
        <Button size="lg" loading={pending} onPress={submit}>
          Create account
        </Button>
        <SwitchLink
          prefix="Already have an account? "
          label="Sign in"
          href={{ pathname: '/sign-in', params: returnTo === undefined ? undefined : { returnTo } }}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  brand: { backgroundColor: colors.brand, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 32, gap: 8 },
  brandRegister: { paddingBottom: 24 },
  titleBlock: { paddingHorizontal: 8, gap: 4 },
  form: { paddingHorizontal: 16, paddingVertical: 24, gap: 16 },
  alert: { backgroundColor: colors.dangerSoft, borderRadius: radius.control, padding: 12 },
  center: { textAlign: 'center' },
  link: { color: colors.accent, fontFamily: fontFamily(600) },
})
