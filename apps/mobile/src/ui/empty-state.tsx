import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Text } from './text'

type Props = {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, icon, action }: Props) {
  return (
    <View style={{ alignItems: 'center', gap: 8, padding: 24 }}>
      {icon}
      <Text variant="h2" heading={2} style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {description ? (
        <Text tone="inkMuted" style={{ textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}
      {action}
    </View>
  )
}
