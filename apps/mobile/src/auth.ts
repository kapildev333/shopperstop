import type { components } from '@shopperstop/ui/api'
import { api, call, queryClient, type ApiError } from './api'
import { setToken } from './session'

type CustomerSession = components['schemas']['CustomerSession']

// Only a same-origin path is kept; anything else (absolute URL, protocol-relative, backslash trick) goes home.
export function safeReturnTo(raw: unknown): string {
  return typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/'
}

function startSession({ token, customer }: CustomerSession) {
  queryClient.clear()
  setToken(token)
  queryClient.setQueryData(['me', token], customer)
}

// Runs a request that answers a session; starts the session on success, else returns the error to show.
async function openSession(
  request: () => Promise<{ data?: CustomerSession; error?: { error: ApiError } }>,
): Promise<ApiError | undefined> {
  const opened: { session?: CustomerSession } = {}
  const error = await call(async () => {
    const result = await request()
    opened.session = result.data
    return result
  })
  if (error) return error
  if (!opened.session) return { code: 'internal', message: 'Core answered without a session. Try again.' }
  startSession(opened.session)
  return undefined
}

export function signIn(body: { email: string; password: string }) {
  return openSession(() => api.POST('/auth/sign-in', { body }))
}

export function register(body: { name: string; email: string; password: string }) {
  return openSession(() => api.POST('/auth/register', { body }))
}

// The result is ignored: the session ends here even when core cannot be reached.
export async function signOut() {
  await call(() => api.POST('/auth/sign-out'))
  setToken(undefined)
  queryClient.clear()
}
