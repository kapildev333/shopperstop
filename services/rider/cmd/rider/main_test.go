package main

import (
	"context"
	"io"
	"net"
	"net/http"
	"sync"
	"testing"
	"time"
)

// TestServeDrainsInFlightRequest stops serve while a request is blocked in
// its handler. The request must still get its full response, and serve must
// return nil.
func TestServeDrainsInFlightRequest(t *testing.T) {
	entered := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	mux := http.NewServeMux()
	mux.HandleFunc("/slow", func(w http.ResponseWriter, _ *http.Request) {
		once.Do(func() { close(entered) })
		<-release
		_, _ = io.WriteString(w, "drained")
	})

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := &http.Server{Handler: mux}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	serveErr := make(chan error, 1)
	go func() { serveErr <- serve(ctx, srv, ln, 10*time.Second) }()

	type result struct {
		status int
		body   string
		err    error
	}
	got := make(chan result, 1)
	go func() {
		resp, err := http.Get("http://" + ln.Addr().String() + "/slow")
		if err != nil {
			got <- result{err: err}
			return
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		got <- result{status: resp.StatusCode, body: string(body), err: err}
	}()

	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("request never reached the handler")
	}
	cancel()       // stop asked while the request is in flight
	close(release) // let the handler finish after the stop

	select {
	case r := <-got:
		if r.err != nil || r.status != http.StatusOK || r.body != "drained" {
			t.Fatalf("in-flight request: status %d body %q err %v, want 200 \"drained\"", r.status, r.body, r.err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("in-flight request did not complete")
	}
	select {
	case err := <-serveErr:
		if err != nil {
			t.Fatalf("serve returned %v, want nil", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("serve did not return")
	}
}

// TestServerReadHeaderTimeout bounds a client that trickles request headers,
// so it cannot hold a graceful shutdown for the whole grace period.
func TestServerReadHeaderTimeout(t *testing.T) {
	if got := newHTTPServer(http.NotFoundHandler()).ReadHeaderTimeout; got != 5*time.Second {
		t.Fatalf("ReadHeaderTimeout = %v, want 5s", got)
	}
}
