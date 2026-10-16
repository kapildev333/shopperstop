import { focusManager } from '@tanstack/react-query'
import { AppState, Platform } from 'react-native'

// On iOS and Android Query has no window focus, so returning to the app refetches stale queries only through this. The web export has its own focus events.
export function wireAppFocus(): () => void {
  if (Platform.OS === 'web') return () => undefined
  const subscription = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'))
  return () => subscription.remove()
}
