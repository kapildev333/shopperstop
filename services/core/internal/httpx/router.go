package httpx

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// NewRouter returns the core router with its middleware in order: request
// id, log and recover, CORS for origins, then whatever routes the caller
// registers. Unknown paths and wrong methods get the 404 envelope.
func NewRouter(origins []string) chi.Router {
	r := chi.NewRouter()
	r.Use(requestID, logAndRecover, cors(origins))
	r.NotFound(notFound)
	r.MethodNotAllowed(notFound)
	return r
}

func notFound(w http.ResponseWriter, r *http.Request) {
	WriteError(w, r, &Error{Status: http.StatusNotFound, Code: "not_found", Message: "not found"})
}

// requestID keeps a client X-Request-Id of 1 to 128 bytes, otherwise makes
// 16 random bytes in hex, and echoes it on the response and in the context.
func requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-Id")
		if len(id) < 1 || len(id) > 128 {
			var b [16]byte
			// crypto/rand.Read does not fail on supported platforms (Go 1.24+).
			_, _ = rand.Read(b[:])
			id = hex.EncodeToString(b[:])
		}
		w.Header().Set("X-Request-Id", id)
		ctx := context.WithValue(r.Context(), requestIDKey{}, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

type subjectKey struct{}

// subject is the signed-in subject of one request. logAndRecover puts it in
// the context, SetSubject fills it, and the request log line reads it.
type subject struct{ typ, id string }

// SetSubject records who the request is signed in as, so the request log line
// carries subjectType and subjectId. Outside a request from NewRouter it does nothing.
func SetSubject(ctx context.Context, subjectType, id string) {
	if s, ok := ctx.Value(subjectKey{}).(*subject); ok {
		s.typ, s.id = subjectType, id
	}
}

// logAndRecover logs one "request" line per request with the route pattern
// (never the raw path) and the subject when one was set. A panic is logged
// with its stack and answered 500 internal; the panic text never reaches the client.
func logAndRecover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		id := RequestID(r.Context())
		sub := &subject{}
		r = r.WithContext(context.WithValue(r.Context(), subjectKey{}, sub))
		// Deferred in this order, so the recover runs first and the log line sees its 500.
		defer func() {
			attrs := []any{
				"method", r.Method,
				"route", chi.RouteContext(r.Context()).RoutePattern(),
				"status", ww.Status(),
				"durationMs", time.Since(start).Milliseconds(),
				"requestId", id,
			}
			if sub.typ != "" {
				attrs = append(attrs, "subjectType", sub.typ, "subjectId", sub.id)
			}
			slog.InfoContext(r.Context(), "request", attrs...)
		}()
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler {
					panic(v) // net/http aborts the response silently; do not log or answer it
				}
				slog.ErrorContext(r.Context(), "panic", "panic", v, "requestId", id, "stack", string(debug.Stack()))
				WriteError(ww, r, &Error{Status: http.StatusInternalServerError, Code: "internal", Message: "internal error"})
			}
		}()
		next.ServeHTTP(ww, r)
	})
}
