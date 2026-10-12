const KEY = 'shopperstop:staff-token'

// Memory is the source for every request; localStorage keeps the session across reloads (Spec 2 §5).
// Storage can be blocked or full (privacy modes, disabled cookies): the token then lives in memory only.
function read() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function write(value: string | null) {
  try {
    if (value) localStorage.setItem(KEY, value)
    else localStorage.removeItem(KEY)
  } catch {
    // Not persisted; the memory copy still holds for this page.
  }
}

let token = read()

export function getToken() {
  return token
}

export function setToken(value: string) {
  token = value
  write(value)
}

export function clearToken() {
  token = null
  write(null)
}
