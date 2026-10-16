import type { ComponentType } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native'
import { Text, type Tone } from './text'
import { colors, radius, spacing } from './tokens'

export type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ghostDanger'
export type Size = 'md' | 'lg' | 'compact'

type ButtonProps = {
  children: string
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  // Overrides the name read from the visible text (the account's "Edit" is "Edit profile").
  accessibilityLabel?: string
  // Lucide icon, 16 px, in the label tone, before the text.
  icon?: ComponentType<{ size?: number; color?: string }>
  onPress?: () => void
}

// Frame and label colour per variant; the label tone also colours the spinner.
const frames: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  danger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  ghost: {},
  ghostDanger: {},
}

const labelTone: Record<Variant, Tone> = {
  primary: 'onAccent',
  secondary: 'ink',
  danger: 'danger',
  ghost: 'accent',
  ghostDanger: 'danger',
}

const sizes: Record<Size, ViewStyle> = {
  md: { minHeight: 44, paddingHorizontal: spacing.gutter },
  lg: { minHeight: 48, paddingHorizontal: spacing.gutter },
  compact: { minHeight: 44, paddingHorizontal: 8 },
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  accessibilityLabel,
  icon: Icon,
  onPress,
}: ButtonProps) {
  const inactive = disabled || loading
  const tone = labelTone[variant]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.frame,
        frames[variant],
        sizes[size],
        variant === 'primary' && pressed ? { backgroundColor: colors.accentHover } : null,
        inactive ? styles.inactive : null,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={colors[tone]} /> : null}
      {Icon ? <Icon size={16} color={colors[tone]} /> : null}
      <Text variant="button" tone={tone}>
        {children}
      </Text>
    </Pressable>
  )
}

type IconButtonProps = {
  label: string
  icon: ComponentType<{ size?: number; color?: string }>
  tone?: Tone
  disabled?: boolean
  onPress?: () => void
}

// A 44 px hit area around a 20 px Lucide icon. `label` is the accessible name, so it is required.
export function IconButton({ label, icon: Icon, tone = 'ink', disabled = false, onPress }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.frame, styles.icon, disabled ? styles.inactive : null]}
    >
      <Icon size={20} color={colors[tone]} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  frame: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.unit * 2,
    borderRadius: radius.control,
  },
  icon: {
    width: 44,
    height: 44,
  },
  inactive: {
    opacity: 0.5,
  },
})
