import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'

// Placeholder for admin-P2-L1's nav; the page lane replaces it.
export const Route = createFileRoute('/_staff/_admin/stores/')({ component: () => <PageHeader title="Stores" /> })
