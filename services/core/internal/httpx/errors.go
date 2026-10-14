// Package httpx holds the core service's HTTP plumbing: the JSON helpers,
// the error envelope, the router with its middleware and CORS.
package httpx

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
)

// Error is one API error. It is the body of the error envelope
// {"error": {...}}; Status is the HTTP status and is not serialised.
type Error struct {
	Status     int      `json:"-"`
	Code       string   `json:"code"`
	Message    string   `json:"message"`
	Field      string   `json:"field,omitempty"`
	ProductIDs []string `json:"productIds,omitempty"` // only with out_of_stock
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

type requestIDKey struct{}

// RequestID returns the request id the router stored in ctx, or "" outside a request.
func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

// WriteError writes err as the error envelope. An *Error keeps its status,
// code and field; anything else is logged with the request id and becomes
// 500 internal, so the client never sees the cause.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	var apiErr *Error
	if !errors.As(err, &apiErr) {
		slog.ErrorContext(r.Context(), "unhandled error", "err", err, "requestId", RequestID(r.Context()))
		apiErr = &Error{Status: http.StatusInternalServerError, Code: "internal", Message: "internal error"}
	}
	WriteJSON(w, apiErr.Status, struct {
		Error *Error `json:"error"`
	}{apiErr})
}
