import { StyleSheet } from 'react-native'
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

const styles = StyleSheet.create({
  alert: { marginTop: spacing.unit },
})
