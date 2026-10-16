import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from './text'
import { colors, radius, spacing } from './tokens'

// A labelled on/off switch. A Pressable rather than RN's Switch: its web markup has no aria-checked and nests an input in the role.
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      // react-native-web reads aria-checked for a switch; accessibilityState alone leaves the web markup without it.
      aria-checked={checked}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.track, checked ? styles.trackOn : styles.trackOff]}>
        <View style={styles.thumb} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.unit * 2,
    minHeight: 44,
  },
  label: {
    flex: 1,
  },
  track: {
    width: 44,
    height: 26,
    borderRadius: radius.pill,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  trackOff: {
    backgroundColor: colors.lineStrong,
  },
  trackOn: {
    backgroundColor: colors.accent,
    alignItems: 'flex-end',
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
})
