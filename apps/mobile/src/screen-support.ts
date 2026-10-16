import { useRouter } from 'expo-router'
import { type ApiError } from './api'

export type Errors = { fields: Record<string, string>; banner?: string }

// An envelope error naming a shown field goes under that field; any other failure goes in the alert.
export function splitError(error: ApiError | undefined, fields: readonly string[]): Errors {
  if (!error) return { fields: {} }
  const field = error.field
  return field && fields.includes(field) ? { fields: { [field]: error.message } } : { fields: {}, banner: error.message }
}

// Back goes to the previous screen when there is one, else Home (the deep-link case).
export function useBack() {
  const router = useRouter()
  return () => (router.canGoBack() ? router.back() : router.replace('/'))
}
