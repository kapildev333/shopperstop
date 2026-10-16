package httpx

import (
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
)

var canonicalUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// IsUUID reports whether s is a uuid in canonical hyphenated form (either case):
// the only ids the API accepts, so a malformed one never reaches Postgres.
func IsUUID(s string) bool {
	return canonicalUUID.MatchString(s)
}

// PathID returns the path parameter name when it is a uuid in canonical
// hyphenated form (either case). Anything else is 404 not_found, the same
// answer as an id that does not exist, so a malformed id never reaches Postgres.
func PathID(r *http.Request, name string) (string, error) {
	id := chi.URLParam(r, name)
	if !IsUUID(id) {
		return "", &Error{Status: http.StatusNotFound, Code: "not_found", Message: "not found"}
	}
	return id, nil
}
