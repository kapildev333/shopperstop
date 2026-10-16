package httpx

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
)

const maxJSONBytes = 1 << 20

// WriteJSON writes v as JSON with the given status. An encode failure is
// logged; the status line is already sent by then.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("encode response", "err", err)
	}
}

// ReadJSON decodes the request body into dst. Every failure is an *Error
// with status 400 and code validation: over 1 MiB, a NUL byte (raw or as
// the escape \u0000), or JSON that does not decode into dst.
func ReadJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxJSONBytes))
	var tooBig *http.MaxBytesError
	if errors.As(err, &tooBig) {
		return &Error{Status: http.StatusBadRequest, Code: "validation", Message: "body too large"}
	}
	if err != nil {
		return &Error{Status: http.StatusBadRequest, Code: "validation", Message: "invalid JSON"}
	}
	// Ceiling: a byte search, so the literal text \u0000 inside a string is refused too.
	if bytes.IndexByte(body, 0) >= 0 || bytes.Contains(body, []byte(`\u0000`)) {
		return &Error{Status: http.StatusBadRequest, Code: "validation", Message: "body contains a NUL byte"}
	}
	if err := json.Unmarshal(body, dst); err != nil {
		return &Error{Status: http.StatusBadRequest, Code: "validation", Message: "invalid JSON"}
	}
	return nil
}
