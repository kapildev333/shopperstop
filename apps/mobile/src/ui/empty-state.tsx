import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Text } from './text'

type Props = {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  // The heading level of the title: 1 for a page's only heading, 2 inside a page.
  level?: 1 | 2
}

export function EmptyState({ title, description, icon, action, level = 2 }: Props) {
  return (
    <View style={{ alignItems: 'center', gap: 8, padding: 24 }}>
      {icon}
      <Text variant="h2" heading={level} style={{ textAlign: 'center' }}>
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
