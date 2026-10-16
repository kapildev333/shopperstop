package main

import (
	"io"
	"strings"
	"testing"
)

// The argument refusals return before any config load or database call.
func TestRunRefusesBadArguments(t *testing.T) {
	for _, args := range [][]string{{}, {"bogus"}, {"migrate", "extra"}} {
		var stderr strings.Builder
		if code := run(args, io.Discard, &stderr); code != 2 || !strings.Contains(stderr.String(), "usage: rider-admin migrate") {
			t.Fatalf("run %v: exit %d stderr %q, want exit 2 with the usage line", args, code, stderr.String())
		}
	}
}
