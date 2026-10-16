import { SafeAreaView } from 'react-native-safe-area-context'
import { View } from 'react-native'
import { EmptyState } from '../../ui/empty-state'
import { Text } from '../../ui/text'
import { colors } from '../../ui/tokens'

// L1 placeholder: the order list arrives with L4.
export default function Orders() {
  return (
    <View role="main" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={{ height: 64, justifyContent: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Text variant="h2" heading={1}>
            Your orders
          </Text>
        </View>
      </SafeAreaView>
      <EmptyState title="Nothing here yet" />
    </View>
  )
}
