package auth

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// fakeClock is the limiter's only fake: the process clock, moved by hand.
type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time { return c.t }

func TestLimiterEmail(t *testing.T) {
	clk := &fakeClock{t: time.Date(2026, 10, 12, 9, 0, 0, 0, time.UTC)}
	l := NewLimiter(10, 100, time.Hour, clk.now)
	for i := range 10 {
		if !l.Allow("Slow@Example.com", fmt.Sprintf("10.0.0.%d", i)) {
			t.Fatalf("attempt %d refused, want allowed", i+1)
		}
	}
	if l.Allow(" slow@example.com ", "10.0.0.99") {
		t.Fatal("11th attempt for the same email (other case) allowed, want refused")
	}
}

func TestLimiterIP(t *testing.T) {
	clk := &fakeClock{t: time.Date(2026, 10, 12, 9, 0, 0, 0, time.UTC)}
	l := NewLimiter(10, 100, time.Hour, clk.now)
	for i := range 100 {
		if !l.Allow(fmt.Sprintf("user%d@example.com", i), "203.0.113.7") {
			t.Fatalf("attempt %d from one IP refused, want allowed", i+1)
		}
	}
	if l.Allow("user100@example.com", "203.0.113.7") {
		t.Fatal("101st attempt from one IP allowed, want refused")
	}
}

func TestLimiterWindowPasses(t *testing.T) {
	clk := &fakeClock{t: time.Date(2026, 10, 12, 9, 0, 0, 0, time.UTC)}
	l := NewLimiter(10, 100, time.Hour, clk.now)
	for range 11 {
		l.Allow("slow@example.com", "203.0.113.7")
	}
	if l.Allow("slow@example.com", "203.0.113.7") {
		t.Fatal("attempt inside the window allowed, want refused")
	}
	clk.t = clk.t.Add(time.Hour)
	if !l.Allow("slow@example.com", "203.0.113.7") {
		t.Fatal("attempt after the window refused, want allowed")
	}
}

// TestLimiterConcurrent: 50 goroutines share two keys; exactly the first 500
// attempts for the email are allowed and every attempt is counted once.
func TestLimiterConcurrent(t *testing.T) {
	clk := &fakeClock{t: time.Date(2026, 10, 12, 9, 0, 0, 0, time.UTC)}
	l := NewLimiter(500, 1000, time.Hour, clk.now)
	var refused atomic.Int64
	var wg sync.WaitGroup
	for range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range 20 {
				if !l.Allow("Shared@Example.com", "10.0.0.1") {
					refused.Add(1)
				}
			}
		}()
	}
	wg.Wait()
	if got := refused.Load(); got != 500 {
		t.Fatalf("%d attempts refused, want 500 of 1000", got)
	}
	if got := l.hits["email:shared@example.com"].count; got != 1000 {
		t.Fatalf("email counted %d attempts, want 1000", got)
	}
	if got := l.hits["ip:10.0.0.1"].count; got != 1000 {
		t.Fatalf("ip counted %d attempts, want 1000", got)
	}
}

// TestLimiterPrunesOncePerWindow crosses the prune threshold. The first scan
// drops ended windows; a second scan inside the same window is skipped.
func TestLimiterPrunesOncePerWindow(t *testing.T) {
	t0 := time.Date(2026, 10, 12, 9, 0, 0, 0, time.UTC)
	clk := &fakeClock{t: t0}
	l := NewLimiter(10, 100_000, time.Hour, clk.now)
	fill := func(prefix string, n int) {
		for i := range n {
			l.Allow(fmt.Sprintf("%s%d@example.com", prefix, i), "203.0.113.1")
		}
	}
	half := pruneAt / 2
	fill("a", half) // windows end at 10:00
	clk.t = t0.Add(30 * time.Minute)
	fill("b", half) // windows end at 10:30 + 1h: the map stays at the threshold, no scan yet

	clk.t = t0.Add(time.Hour) // the "a" windows have ended; the threshold is crossed, so this is the first scan
	l.Allow("trigger@example.com", "203.0.113.2")
	if n := len(l.hits); n != half+2 {
		t.Fatalf("after the first prune %d keys, want %d (the \"a\" keys gone)", n, half+2)
	}
	fill("d", half) // windows end at 11:00; over the threshold, but a scan at 11:00 drops nothing

	clk.t = t0.Add(100 * time.Minute) // the "b" windows have ended, under a window since the prune
	l.Allow("late@example.com", "203.0.113.2")
	if n := len(l.hits); n <= pruneAt {
		t.Fatalf("%d keys 40 minutes after the prune, want the scan skipped (more than %d)", n, pruneAt)
	}

	clk.t = t0.Add(130 * time.Minute) // a window has passed since the prune
	l.Allow("later@example.com", "203.0.113.2")
	if n := len(l.hits); n > 4 {
		t.Fatalf("%d keys a window after the prune, want the ended keys gone (about 3)", n)
	}
	if !l.Allow("new@example.com", "203.0.113.3") {
		t.Fatal("new key after the prune refused, want allowed")
	}
}
