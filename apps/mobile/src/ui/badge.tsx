import { colors, radius, fontFamily } from './tokens'
import { Text } from './text'

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'accent'

const surface: Record<BadgeVariant, string> = {
  neutral: colors.canvas,
  success: colors.successSoft,
  warning: colors.warningSoft,
  danger: colors.dangerSoft,
  accent: colors.accentSoft,
}

// Badge is a Text with its own fill, so the label and its background are one element.
export function Badge({ variant = 'neutral', children }: { variant?: BadgeVariant; children: string }) {
  return (
    <Text
      variant="small"
      style={{
        fontFamily: fontFamily(600),
        backgroundColor: surface[variant],
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        overflow: 'hidden',
      }}
    >
      {children}
    </Text>
  )
}
