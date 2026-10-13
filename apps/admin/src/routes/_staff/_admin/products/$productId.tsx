import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'

// Placeholder so the products table's typed links compile; task 3 replaces it.
export const Route = createFileRoute('/_staff/_admin/products/$productId')({ component: () => <PageHeader title="Product" /> })
