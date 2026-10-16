package auth

import (
	"strings"
	"sync"
	"time"
)

// pruneAt is the key count above which Allow may drop keys whose window ended.
const pruneAt = 10_000

// bucket is one key's attempts in the window that started at start.
type bucket struct {
	start time.Time
	count int
}

// Limiter counts attempts in fixed windows per key, in memory and per process.
// ponytail: per process; memory is bounded only per window: above pruneAt keys
// the ended ones are dropped at most once per window, so a flood of distinct
// keys can hold up to a window's worth of buckets. A proxy shares one IP bucket.
type Limiter struct {
	mu        sync.Mutex
	perEmail  int
	perIP     int
	window    time.Duration
	now       func() time.Time
	hits      map[string]*bucket
	lastPrune time.Time
}

// NewLimiter returns a limiter allowing perEmail attempts per email and
// perIP per client IP within each window, timed by now.
func NewLimiter(perEmail, perIP int, window time.Duration, now func() time.Time) *Limiter {
	return &Limiter{perEmail: perEmail, perIP: perIP, window: window, now: now, hits: map[string]*bucket{}}
}

// Allow counts one attempt against its email (compared without case and
// surrounding spaces) and its IP, and reports whether both are within limit.
// Every attempt counts, including refused ones.
func (l *Limiter) Allow(email, ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if len(l.hits) > pruneAt && now.Sub(l.lastPrune) >= l.window {
		l.lastPrune = now
		for key, b := range l.hits {
			if !now.Before(b.start.Add(l.window)) {
				delete(l.hits, key)
			}
		}
	}
	e := l.count("email:"+strings.ToLower(strings.TrimSpace(email)), now)
	i := l.count("ip:"+ip, now)
	return e <= l.perEmail && i <= l.perIP
}

// count adds one attempt to key, starting a new window when the old one ended.
func (l *Limiter) count(key string, now time.Time) int {
	b, ok := l.hits[key]
	if !ok || !now.Before(b.start.Add(l.window)) {
		b = &bucket{start: now}
		l.hits[key] = b
	}
	b.count++
	return b.count
}
