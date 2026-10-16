import type { ReactNode } from 'react'
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native'
import { Text } from './text'
import { colors, fontFamily, radius, spacing } from './tokens'

type Props = Omit<TextInputProps, 'style'> & {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  // A pressable inside the frame, on the right of the input (the password's show and hide).
  trailing?: ReactNode
  // Tabular figures and letter spacing, for codes and numbers such as a pincode.
  tabular?: boolean
}

// The hint is what a screen reader reads with the input; a shown error replaces it.
export function FormField({ label, hint, error, optional, trailing, tabular, ...input }: Props) {
  const message = error ?? hint
  return (
    <View>
      <View style={styles.labelRow}>
        <Text variant="body" style={styles.label}>
          {label}
        </Text>
        {optional ? <Text tone="inkMuted">(optional)</Text> : null}
      </View>
      <View testID="form-field-frame" style={[styles.frame, error ? styles.frameError : null]}>
        <TextInput
          {...input}
          accessibilityLabel={label}
          accessibilityHint={message}
          placeholderTextColor={colors.inkMuted}
          style={[styles.input, tabular ? styles.tabular : null]}
        />
        {trailing}
      </View>
      {message ? (
        <Text variant="small" tone={error ? 'danger' : 'inkMuted'} style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.unit },
  label: { fontFamily: fontFamily(600) },
  frame: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  frameError: { borderColor: colors.danger },
  input: {
    flex: 1,
    fontFamily: fontFamily(400),
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  tabular: { fontVariant: ['tabular-nums'], letterSpacing: 2 },
  message: { marginTop: 6 },
})
