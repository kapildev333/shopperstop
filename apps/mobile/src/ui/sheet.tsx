import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
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
  // The content scrolls past 80% of the window, leaving room for the header and the keyboard on a small phone.
  const { height } = useWindowDimensions()
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
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.8 }}>
              {children}
            </ScrollView>
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
