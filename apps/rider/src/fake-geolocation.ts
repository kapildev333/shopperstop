type Watch = { success: PositionCallback; failure: PositionErrorCallback | null }

// The test fake of navigator.geolocation, installed on the navigator (jsdom has none): one entry per watchPosition, until clearWatch.
export function fakeGeolocation() {
  const watches = new Map<number, Watch>()
  let next = 1
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition(success: PositionCallback, failure?: PositionErrorCallback | null) {
        watches.set(next, { success, failure: failure ?? null })
        return next++
      },
      clearWatch(id: number) {
        watches.delete(id)
      },
    },
  })
  return {
    fix(lat: number, lng: number) {
      for (const { success } of watches.values()) success({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition)
    },
    fail(code: number) {
      for (const { failure } of watches.values()) failure?.({ code, message: 'fake' } as GeolocationPositionError)
    },
    watching: () => watches.size,
    remove() {
      delete (navigator as { geolocation?: Geolocation }).geolocation
    },
  }
}
