import { useSyncExternalStore } from 'react'

// "12 min ago" for a card; whole minutes, hours above 59.
export function since(at: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(at)) / 60_000))
  if (minutes === 0) return 'just now'
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`
}

// The text of `since`, kept current: only the component that calls this renders again, and only when the text changes.
function everyFewSeconds(tick: () => void) {
  const id = setInterval(tick, 5_000)
  return () => clearInterval(id)
}
export const useSince = (at: string) => useSyncExternalStore(everyFewSeconds, () => since(at, Date.now()))

// "13 Oct 2026, 2:50 pm", in the stores' time zone whatever the browser's is.
const stamp = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
export const when = (at: string) => stamp.format(new Date(at))
