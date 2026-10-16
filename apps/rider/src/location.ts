import { useEffect, useState } from 'react'
import { rider } from './api'

// While a delivery is on the way the device position is sent at once and then the latest one every 15 s.
// Ceiling: positions go out only while the page is open and the phone screen is on (no background location in a web app).
const everyMs = 15_000
const off = 'Location is off. The customer cannot see where you are.'

// The message to show while `active`, or nothing. Failed sends are ignored: the next position is sent as scheduled.
export function useLocationReport(active: boolean): string | undefined {
  const [failed, setFailed] = useState(false)
  const unavailable = !('geolocation' in navigator)

  useEffect(() => {
    if (!active || unavailable) return
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
      () => setFailed(true),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )
    return () => {
      geolocation.clearWatch(watch)
      clearInterval(timer)
    }
  }, [active, unavailable])

  return active && (failed || unavailable) ? off : undefined
}
