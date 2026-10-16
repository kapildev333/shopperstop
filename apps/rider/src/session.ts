import { createTokenStore } from '@shopperstop/ui/app'

// Memory first, mirrored to localStorage (memory only when storage is blocked): the shared store (Spec 2 §5, D29 key).
export const session = createTokenStore('shopperstop:rider-token')
export const getToken = session.get
export const setToken = (token: string) => session.set(token)
export const clearToken = () => session.set(undefined)
