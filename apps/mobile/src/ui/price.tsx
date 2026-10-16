import { StyleSheet, View } from 'react-native'
import { formatInr } from '@shopperstop/ui/format'
import { Text } from './text'
import { fontFamily } from './tokens'

type Props = {
  cents: number
  mrpCents?: number
  size?: 'md' | 'lg'
  layout?: 'row' | 'column'
}

// Price is the rupee amount in the action colour; the MRP is struck through only when it is higher.
export function Price({ cents, mrpCents, size = 'md', layout = 'column' }: Props) {
  const showMrp = mrpCents !== undefined && mrpCents > cents
  return (
    <View style={layout === 'row' ? styles.row : styles.column}>
      {size === 'lg' ? (
        <Text variant="h2" tone="accent" tabular>
          {formatInr(cents)}
        </Text>
      ) : (
        <Text variant="body" tone="accent" tabular style={styles.md}>
          {formatInr(cents)}
        </Text>
      )}
      {showMrp ? (
        <Text
          variant="small"
          tone="inkMuted"
          tabular
          accessibilityLabel={`MRP ${formatInr(mrpCents)}`}
          style={styles.mrp}
        >
          {formatInr(mrpCents)}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  column: { alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  md: { fontFamily: fontFamily(600) },
  mrp: { textDecorationLine: 'line-through' },
})
