import type { ReactNode } from 'react'
import { View } from 'react-native'
import { colors, radius, shadows } from './tokens'

export function Card({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        padding: 16,
        boxShadow: shadows.card.boxShadow,
      }}
    >
      {children}
    </View>
  )
}
