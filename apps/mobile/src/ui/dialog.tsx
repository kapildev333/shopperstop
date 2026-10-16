import { Children, type ReactNode } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import { Text } from './text'
import { colors, radius, shadows, spacing } from './tokens'

type DialogProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

// A centred modal on a dimmed backdrop. The backdrop does not close it: `onRequestClose` covers the Android back gesture and Escape on the web export.
export function Dialog({ open, title, onClose, children }: DialogProps) {
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose} accessibilityLabel={title}>
      <View style={styles.root}>
        <View style={[StyleSheet.absoluteFill, styles.backdrop]} />
        <View style={styles.panel} accessibilityViewIsModal>
          <Text variant="h2" heading={2}>
            {title}
          </Text>
          {children}
        </View>
      </View>
    </Modal>
  )
}

// One row of equal-width buttons. Callers put the cancel button first.
export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <View style={styles.footer}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={styles.action}>
          {child}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  backdrop: {
    backgroundColor: colors.ink,
    opacity: 0.5,
  },
  panel: {
    marginHorizontal: spacing.gutter,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    boxShadow: shadows.sheet.boxShadow,
    padding: spacing.unit * 5,
    gap: spacing.unit * 4,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.unit * 3,
  },
  action: {
    flex: 1,
  },
})
