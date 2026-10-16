import { createFileRoute } from '@tanstack/react-router'
import { ReadyPage } from '../../ready'

export const Route = createFileRoute('/_rider/')({
  component: ReadyPage,
})
