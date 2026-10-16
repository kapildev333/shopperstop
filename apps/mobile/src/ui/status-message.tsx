import { StyleSheet, View } from 'react-native'
import { CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { colors, radius } from './tokens'
import { Text } from './text'

export type StatusTone = 'neutral' | 'success' | 'warning'

const tones: Record<StatusTone, { icon: LucideIcon; background: string; iconColor: string }> = {
  neutral: { icon: Info, background: colors.canvas, iconColor: colors.inkMuted },
  success: { icon: CircleCheck, background: colors.successSoft, iconColor: colors.success },
  warning: { icon: TriangleAlert, background: colors.warningSoft, iconColor: colors.warning },
}

// A polite live region: a status the screen reader announces when it appears, without taking focus.
export function StatusMessage({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) {
  const { icon: Icon, background, iconColor } = tones[tone]
  return (
    <View
      accessible
      role="status"
      accessibilityLiveRegion="polite"
      style={[styles.row, { backgroundColor: background }]}
    >
      <View testID="status-icon" aria-hidden>
        <Icon size={16} color={iconColor} />
      </View>
      <Text style={styles.label}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.control,
  },
  label: {
    flex: 1,
  },
})
