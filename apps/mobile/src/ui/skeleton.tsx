import { View } from 'react-native'
import { colors, radius } from './tokens'

// ponytail: static blocks, no pulse; add an Animated loop when someone asks for it.
export function Skeleton({ count = 1 }: { count?: number }) {
  return (
    <View accessible accessibilityLabel="Loading" style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          testID="skeleton-block"
          style={{ height: 64, borderRadius: radius.card, backgroundColor: colors.line }}
        />
      ))}
    </View>
  )
}
