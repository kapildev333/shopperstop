import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'

// Placeholder for admin-P2-L2's create page; task 2 replaces it with the store form.
export const Route = createFileRoute('/_staff/_admin/stores/new')({ component: () => <PageHeader title="New store" /> })
