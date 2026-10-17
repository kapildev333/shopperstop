package dispatch

import "math"

const earthRadiusMetres = 6371000.0

// distance is the haversine distance in metres between two positions in degrees.
func distance(aLat, aLng, bLat, bLng float64) float64 {
	rad := math.Pi / 180
	dLat, dLng := (bLat-aLat)*rad, (bLng-aLng)*rad
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(aLat*rad)*math.Cos(bLat*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadiusMetres * math.Asin(math.Sqrt(h))
}

// etaSeconds is the time to cover metres at speedKMH, rounded to the second;
// within 100 m the rider is at the store, 0.
// ponytail: straight line at one speed; a routing API's travel time when ranking needs roads.
func etaSeconds(metres, speedKMH float64) int32 {
	if metres <= 100 {
		return 0
	}
	return int32(math.Round(metres / (speedKMH / 3.6)))
}
