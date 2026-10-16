import { useState } from 'react'
import { StyleSheet, Switch, View } from 'react-native'
import { saveAddress, type Address } from './addresses'
import { splitError } from './screen-support'
import { Button } from './ui/button'
import { Chip } from './ui/chip'
import { FormField } from './ui/form-field'
import { Sheet } from './ui/sheet'
import { Text } from './ui/text'
import { colors, fontFamily, radius, spacing } from './ui/tokens'

const fieldNames = ['label', 'line1', 'line2', 'pincode'] as const
type Errors = { fields: Partial<Record<(typeof fieldNames)[number], string>>; banner?: string }
const none: Errors = { fields: {} }
const defaultLabels = ['Home', 'Work', 'Other']

// Adds when `address` is absent, edits when present. Closes only on success; the form is mounted only while open, so each open starts fresh.
export function AddressSheet({ open, address, onClose }: { open: boolean; address?: Address; onClose: () => void }) {
  return (
    <Sheet open={open} title={address ? 'Edit address' : 'Add address'} onClose={onClose}>
      {open ? <AddressForm address={address} onClose={onClose} /> : null}
    </Sheet>
  )
}

function AddressForm({ address, onClose }: { address?: Address; onClose: () => void }) {
  const [label, setLabel] = useState(address?.label ?? 'Home')
  const [line1, setLine1] = useState(address?.line1 ?? '')
  const [line2, setLine2] = useState(address?.line2 ?? '')
  const [pincode, setPincode] = useState(address?.pincode ?? '')
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false)
  const [errors, setErrors] = useState<Errors>(none)
  const [pending, setPending] = useState(false)
  // An edited address keeps its own label as a chip when it is none of the three.
  const labels = address && !defaultLabels.includes(address.label) ? [...defaultLabels, address.label] : defaultLabels

  async function save() {
    const values = { label, line1: line1.trim(), line2: line2.trim(), pincode: pincode.trim(), isDefault }
    const fields: Errors['fields'] = {}
    if (!values.line1) fields.line1 = 'Enter house, flat or floor'
    if (!/^\d{6}$/.test(values.pincode)) fields.pincode = 'Enter a 6-digit pincode'
    if (Object.keys(fields).length > 0) return setErrors({ fields })
    setErrors(none)
    setPending(true)
    const error = await saveAddress(address?.id, values)
    setPending(false)
    if (error) return setErrors(splitError(error, fieldNames))
    onClose()
  }

  return (
    <View style={styles.body}>
      <View>
        <Text variant="body" style={styles.groupLabel}>
          Save as
        </Text>
        <View style={styles.chips}>
          {labels.map((name) => (
            <Chip key={name} selected={label === name} onPress={() => setLabel(name)}>
              {name}
            </Chip>
          ))}
        </View>
        {errors.fields.label ? (
          <Text variant="small" tone="danger" style={styles.message}>
            {errors.fields.label}
          </Text>
        ) : null}
      </View>
      <FormField
        label="House, flat, floor"
        autoComplete="address-line1"
        value={line1}
        onChangeText={setLine1}
        error={errors.fields.line1}
      />
      <FormField
        label="Street and area"
        optional
        autoComplete="address-line2"
        value={line2}
        onChangeText={setLine2}
        error={errors.fields.line2}
      />
      <FormField
        label="Pincode"
        keyboardType="number-pad"
        maxLength={6}
        value={pincode}
        onChangeText={setPincode}
        error={errors.fields.pincode}
      />
      <View style={styles.switchRow}>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel="Make this my default address"
          value={isDefault}
          onValueChange={setIsDefault}
          trackColor={{ false: colors.lineStrong, true: colors.accent }}
          thumbColor={colors.surface}
        />
        <Text style={styles.switchText}>Make this my default address</Text>
      </View>
      {errors.banner ? (
        <View accessible accessibilityRole="alert" style={styles.alert}>
          <Text>{errors.banner}</Text>
        </View>
      ) : null}
      <Button size="lg" loading={pending} onPress={save}>
        Save address
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
  },
  groupLabel: {
    fontFamily: fontFamily(600),
    marginBottom: spacing.unit * 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.unit * 2,
  },
  message: {
    marginTop: spacing.unit,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
    minHeight: 44,
  },
  switchText: {
    flex: 1,
  },
  alert: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.control,
    padding: 12,
  },
})
