import { House, LayoutGrid, ReceiptText } from 'lucide-react-native'
import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '../../ui/text'
import { colors, fontFamily } from '../../ui/tokens'

// The router's own tabs: roles, selected state and safe area come from Expo Router. Styled from tokens only.
export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          height: 72 + insets.bottom,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        },
        tabBarLabel: ({ focused, children }) => (
          <Text
            variant="small"
            tone={focused ? 'accent' : 'inkMuted'}
            style={focused ? { fontFamily: fontFamily(600) } : undefined}
          >
            {children}
          </Text>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen
        name="categories"
        options={{ title: 'Categories', tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Orders', tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size} /> }}
      />
    </Tabs>
  )
}
