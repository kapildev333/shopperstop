package httpx

import (
	"encoding/json"
	"maps"
	"net/http"
	"slices"
)

// ReadPatch decodes a PATCH body into dst, whose fields are pointers. The
// body must be a JSON object. A member whose value is null is refused with
// 400 validation naming it in Field: an absent member leaves its value
// unchanged, so null has no meaning here. Members are checked in sorted order.
func ReadPatch(w http.ResponseWriter, r *http.Request, dst any) error {
	var raw json.RawMessage
	if err := ReadJSON(w, r, &raw); err != nil {
		return err
	}
	var members map[string]json.RawMessage
	if err := json.Unmarshal(raw, &members); err != nil || members == nil {
		return &Error{Status: http.StatusBadRequest, Code: "validation", Message: "invalid JSON"}
	}
	for _, k := range slices.Sorted(maps.Keys(members)) {
		if string(members[k]) == "null" {
			return &Error{Status: http.StatusBadRequest, Code: "validation", Field: k, Message: "must not be null"}
		}
	}
	if err := json.Unmarshal(raw, dst); err != nil {
		return &Error{Status: http.StatusBadRequest, Code: "validation", Message: "invalid JSON"}
	}
	return nil
}
