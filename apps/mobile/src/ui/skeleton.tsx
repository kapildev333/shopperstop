import { View } from 'react-native'
import { colors, radius } from './tokens'

type Props = {
  count?: number
  // rows: full-width bars. tiles: a wrapping grid of square blocks, `columns` per row.
  variant?: 'rows' | 'tiles'
  columns?: number
}

// ponytail: static blocks, no pulse; add an Animated loop when someone asks for it.
export function Skeleton({ count = 1, variant = 'rows', columns = 2 }: Props) {
  const tiles = variant === 'tiles'
  const tileWidth = `${(100 - 8 * (columns - 1)) / columns}%`
  return (
    <View accessible accessibilityLabel="Loading" style={tiles ? { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } : { gap: 12 }}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          testID="skeleton-block"
          style={
            tiles
              ? { width: tileWidth, aspectRatio: 1, borderRadius: radius.card, backgroundColor: colors.line }
              : { height: 64, borderRadius: radius.card, backgroundColor: colors.line }
          }
        />
      ))}
    </View>
  )
}
