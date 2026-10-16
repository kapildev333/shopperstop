import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { IconButton } from './button'
import { Text } from './text'
import { colors, radius, shadows, spacing } from './tokens'

type SheetProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

// A modal from the bottom. `onRequestClose` covers the Android back gesture and Escape on the web export.
export function Sheet({ open, title, onClose, children }: SheetProps) {
  return (
    <Modal transparent visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={styles.panel} accessibilityViewIsModal>
            <View style={styles.header}>
              <Text variant="h2" heading={2} style={styles.title}>
                {title}
              </Text>
              <IconButton label="Close" icon={X} onPress={onClose} />
            </View>
            {children}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: colors.ink,
    opacity: 0.5,
  },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    boxShadow: shadows.sheet.boxShadow,
    paddingTop: spacing.unit * 2,
    paddingHorizontal: spacing.gutter,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.unit * 2,
  },
  title: {
    flex: 1,
  },
})
