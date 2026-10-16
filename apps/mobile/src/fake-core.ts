type Handler = (request: Request) => Response | Promise<Response>

export function json(status: number, body?: unknown) {
  return body === undefined
    ? new Response(null, { status })
    : new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export function apiError(status: number, code: string, message = code, field?: string) {
  return json(status, { error: { code, message, ...(field ? { field } : {}) } })
}

// Fake core at the process boundary: keys are "METHOD /path" under /api/core/v1; unknown routes answer 404 not_found.
// Returns the requests it received, in order. jest.setup.ts resets fetch before each test.
export function fakeCore(routes: Record<string, Handler>) {
  const calls: Request[] = []
  globalThis.fetch = (async (request: Request) => {
    calls.push(request)
    const path = new URL(request.url).pathname.replace('/api/core/v1', '')
    const handler = routes[`${request.method} ${path}`]
    return handler ? handler(request) : apiError(404, 'not_found')
  }) as typeof fetch
  return calls
}
