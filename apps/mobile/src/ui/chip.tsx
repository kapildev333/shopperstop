import { Pressable, type GestureResponderEvent } from 'react-native'
import { Text } from './text'
import { colors, radius } from './tokens'

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
      style={{
        minHeight: 44,
        paddingHorizontal: 16,
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.lineStrong,
        backgroundColor: selected ? colors.accentSoft : colors.surface,
      }}
    >
      <Text style={{ color: selected ? colors.accentHover : colors.ink }}>{children}</Text>
    </Pressable>
  )
}
