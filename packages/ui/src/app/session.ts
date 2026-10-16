export type TokenStore = {
  get(): string | undefined
  set(token: string | undefined): void
  subscribe(listener: () => void): () => void
}

// Token in memory, mirrored to localStorage[key]. Storage that throws (blocked, or absent as in React Native) keeps the token in memory only.
export function createTokenStore(key: string): TokenStore {
  let token: string | undefined
  try {
    token = localStorage.getItem(key) ?? undefined
  } catch {
    token = undefined
  }
  const listeners = new Set<() => void>()
  return {
    get: () => token,
    set(next) {
      token = next
      for (const listener of listeners) listener()
      try {
        if (next === undefined) localStorage.removeItem(key)
        else localStorage.setItem(key, next)
      } catch {
        // memory only
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
