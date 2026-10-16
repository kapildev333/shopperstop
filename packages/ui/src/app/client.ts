import createClient, { type Client } from 'openapi-fetch'
import type { TokenStore } from './session'

export type ApiClientOptions = {
  baseUrl: string
  session?: Pick<TokenStore, 'get' | 'set'>
  onUnauthorized?: () => void
  failureMessage?: string
}

// An openapi-fetch client that sends the session's bearer token, ends the session only on a 401 to the token it sent,
// and turns failures without the { error: { code, message } } envelope into `internal` with `failureMessage`.
export function createApiClient<Paths extends object>(options: ApiClientOptions): Client<Paths> {
  const { baseUrl, session, onUnauthorized, failureMessage = 'The server did not answer as expected.' } = options
  const client = createClient<Paths>({ baseUrl, fetch: (request) => globalThis.fetch(request) })
  client.use({
    onRequest({ request }) {
      const token = session?.get()
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
    },
    async onResponse({ request, response }) {
      if (response.status === 401) {
        const token = session?.get()
        if (token && request.headers.get('Authorization') === `Bearer ${token}`) {
          session?.set(undefined)
          onUnauthorized?.()
        }
      }
      if (response.ok) return response
      const body = await response
        .clone()
        .json()
        .catch(() => undefined)
      if (typeof body?.error?.code === 'string' && typeof body?.error?.message === 'string') return response
      return new Response(JSON.stringify({ error: { code: 'internal', message: failureMessage } }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
  return client
}
