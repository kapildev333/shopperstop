import { StyleSheet } from 'react-native'
import { useStoreName, type CartView } from './cart'
import { StatusMessage } from './ui/status-message'
import { Text } from './ui/text'
import { spacing } from './ui/tokens'

// A failed cart write, one line under the control it was made from; nothing when the control has no failure.
export function CartWriteAlert({ message }: { message?: string }) {
  if (!message) return null
  return (
    <Text variant="small" tone="danger" accessibilityRole="alert" style={styles.alert}>
      {message}
    </Text>
  )
}

// The notice that a signed-in cart was replaced by a store change; the old store's name, or a generic one when core does not say.
export function ReplacedNotice({ view }: { view: CartView }) {
  const replacedFrom = useStoreName(view.replacedStoreId) ?? 'another store'
  return (
    <StatusMessage tone="warning">
      {`Your cart from ${replacedFrom} was replaced. A cart holds products from one store.`}
    </StatusMessage>
  )
}

const styles = StyleSheet.create({
  alert: { marginTop: spacing.unit },
})
