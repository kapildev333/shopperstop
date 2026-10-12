import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'

// Only same-app paths: never an absolute or protocol-relative URL (open redirect).
function safeRedirect(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : undefined
}

// Stub: the form arrives with admin-auth-nav task 3.
export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({ redirect: safeRedirect(search.redirect) }),
  component: () => <PageHeader title="Sign in" />,
})
