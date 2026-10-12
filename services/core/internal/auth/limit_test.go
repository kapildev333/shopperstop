package auth

import (
	"fmt"
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
