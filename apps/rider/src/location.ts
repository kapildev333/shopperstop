import { useEffect, useEffectEvent, useState } from 'react'
import { rider } from './api'

// While a delivery is on the way the device position is sent at once and then the latest one every 15 s.
// Ceiling: positions go out only while the page is open and the phone screen is on (no background location in a web app).
const everyMs = 15_000
const off = 'Location is off. The customer cannot see where you are.'

// Watches the position, sends the first fix at once and then the latest one every `everyMs`. Returns the cleanup that stops both.
function watchAndSend(
  everyMs: number,
  options: PositionOptions,
  onError: (error: GeolocationPositionError) => void,
): () => void {
  let latest: { lat: number; lng: number } | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  const send = (fix: { lat: number; lng: number }) => {
    void rider.PUT('/me/location', { body: fix }).catch(() => undefined)
  }
  const geolocation = navigator.geolocation
  const watch = geolocation.watchPosition(
    (position) => {
      latest = { lat: position.coords.latitude, lng: position.coords.longitude }
      // The count starts with the first fix, so a late first fix is not followed by a send one second later.
      if (timer === undefined) {
        send(latest)
        timer = setInterval(() => latest && send(latest), everyMs)
      }
    },
    onError,
    options,
  )
  return () => {
    geolocation.clearWatch(watch)
    clearInterval(timer)
  }
}

// The message to show while `active`, or nothing. Failed sends are ignored: the next position is sent as scheduled.
export function useLocationReport(active: boolean): string | undefined {
  const [failed, setFailed] = useState(false)
  const unavailable = !('geolocation' in navigator)

  useEffect(() => {
    if (!active || unavailable) return
    return watchAndSend(everyMs, { enableHighAccuracy: true, maximumAge: 10_000 }, () => setFailed(true))
  }, [active, unavailable])

  return active && (failed || unavailable) ? off : undefined
}

// While online the position is reported from the banner's toggle on, so a rider who is online is seen without a delivery.
// A refused permission or a missing Geolocation API calls `onDenied` once; other errors change nothing.
// ponytail: positions on a 10 s interval, not per change (a still rider would go stale on Chromium's per-change callbacks); no background location in a web app.
export function useOnlineReport(online: boolean, onDenied: () => void) {
  const deny = useEffectEvent(onDenied)

  useEffect(() => {
    if (!online) return
    if (!('geolocation' in navigator)) {
      deny()
      return
    }
    return watchAndSend(10_000, { enableHighAccuracy: false, maximumAge: 10_000 }, (error) => {
      if (error.code === 1) deny()
    })
  }, [online])
}
