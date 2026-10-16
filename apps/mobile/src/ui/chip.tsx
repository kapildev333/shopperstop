import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native'
import { Text } from './text'
import { colors, radius, spacing } from './tokens'

export function Chip({
  selected,
  onPress,
  children,
}: {
  selected: boolean
  onPress: (event: GestureResponderEvent) => void
  children: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.frame, selected ? styles.selected : styles.unselected]}
    >
      <Text style={selected ? styles.selectedLabel : styles.unselectedLabel}>{children}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  frame: {
    minHeight: 44,
    paddingHorizontal: spacing.gutter,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  unselected: { borderColor: colors.lineStrong, backgroundColor: colors.surface },
  selectedLabel: { color: colors.accentHover },
  unselectedLabel: { color: colors.ink },
})
