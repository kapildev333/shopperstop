import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { components } from '@shopperstop/ui/api'
import { api, call, queryClient, type ApiError } from './api'
import { getToken } from './session'
import { Button } from './ui/button'
import { FormField } from './ui/form-field'
import { Sheet } from './ui/sheet'
import { Text } from './ui/text'
import { spacing } from './ui/tokens'

type Customer = components['schemas']['Customer']

type Props = {
  open: boolean
  customer: Customer
  onClose: () => void
}

// The form mounts each time the sheet opens, so it is prefilled from the current customer.
export function ProfileSheet({ open, customer, onClose }: Props) {
  return (
    <Sheet open={open} title="Edit profile" onClose={onClose}>
      {open ? <ProfileForm customer={customer} onClose={onClose} /> : null}
    </Sheet>
  )
}

function ProfileForm({ customer, onClose }: Omit<Props, 'open'>) {
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(customer.phone ?? '')
  const [nameError, setNameError] = useState<string>()
  const [phoneError, setPhoneError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Enter your name')
      return
    }
    setNameError(undefined)
    setPhoneError(undefined)
    setFormError(undefined)
    setSaving(true)
    let saved: Customer | undefined
    // An empty phone clears it on core.
    const error = await call(async () => {
      const result = await api.PATCH('/me', { body: { name: trimmed, phone: phone.trim() } })
      saved = result.data
      return result
    })
    setSaving(false)
    if (error) return showError(error)
    if (saved) queryClient.setQueryData(['me', getToken()], saved)
    onClose()
  }

  function showError(error: ApiError) {
    if (error.field === 'name') setNameError(error.message)
    else if (error.field === 'phone') setPhoneError(error.message)
    else setFormError(error.message)
  }

  return (
    <View style={styles.form}>
      <FormField
        label="Name"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        error={nameError}
      />
      <FormField
        label="Phone"
        optional
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        hint="The store sees it on your order so they can call about delivery."
        error={phoneError}
      />
      {formError ? (
        <Text accessibilityRole="alert" tone="danger">
          {formError}
        </Text>
      ) : null}
      <Button size="lg" loading={saving} onPress={() => void save()}>
        Save
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.unit * 3 },
})
