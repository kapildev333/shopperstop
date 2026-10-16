import { StyleSheet, View } from 'react-native'
import { colors, radius, spacing } from './tokens'

type Props = {
  count?: number
  // rows: full-width bars. tiles: a wrapping grid of square blocks, `columns` per row.
  variant?: 'rows' | 'tiles'
  columns?: number
}

const tileGap = spacing.unit * 2

// ponytail: static blocks, no pulse; add an Animated loop when someone asks for it.
export function Skeleton({ count = 1, variant = 'rows', columns = 2 }: Props) {
  const tiles = variant === 'tiles'
  const tileWidth = `${(100 - tileGap * (columns - 1)) / columns}%`
  return (
    <View accessible accessibilityLabel="Loading" style={tiles ? styles.grid : styles.rows}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          testID="skeleton-block"
          style={tiles ? [styles.tile, { width: tileWidth }] : styles.row}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  rows: { gap: spacing.gridGap },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tileGap },
  row: { height: 64, borderRadius: radius.card, backgroundColor: colors.line },
  tile: { aspectRatio: 1, borderRadius: radius.card, backgroundColor: colors.line },
})
