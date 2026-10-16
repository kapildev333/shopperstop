import { User } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { View } from 'react-native'
import { IconButton } from '../../ui/button'
import { Text } from '../../ui/text'
import { colors } from '../../ui/tokens'

// L1 placeholder: the header and the Account button. L2 replaces the body with the catalogue.
export default function Home() {
  const router = useRouter()
  return (
    <View role="main" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.brand }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 12 }}>
          <Text variant="display" heading={1} tone="onBrand" style={{ flex: 1, marginRight: 12 }}>
            Groceries in minutes
          </Text>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <IconButton label="Account" icon={User} onPress={() => router.push('/account')} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}
