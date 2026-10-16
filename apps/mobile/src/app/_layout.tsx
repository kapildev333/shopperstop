import { QueryClientProvider } from '@tanstack/react-query'
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { queryClient } from '../api'
import { wireAppFocus } from '../app-focus'
import { PincodeSheet } from '../pincode-sheet'

// Nothing renders until the bundled Inter faces are loaded, so no text ever falls back to the system font.
export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold })
  useEffect(wireAppFocus, [])
  if (!loaded) return null
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <PincodeSheet />
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
