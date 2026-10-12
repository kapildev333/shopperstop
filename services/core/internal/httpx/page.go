package httpx

import (
	"math"
	"net/http"
	"net/url"
	"strconv"
)

// List is one page of a list response: {items, page, pageSize, total}.
// Items is always an array; Total counts every row, not just this page.
type List[T any] struct {
	Items    []T   `json:"items"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
	Total    int64 `json:"total"`
}

// NewList wraps one page of items. Nil items encode as [].
func NewList[T any](items []T, page, pageSize int, total int64) List[T] {
	if items == nil {
		items = []T{}
	}
	return List[T]{Items: items, Page: page, PageSize: pageSize, Total: total}
}

// Page reads page (default 1, at least 1) and pageSize (default 24, 1 to 100)
// from the query string. A value that is not a whole number, or is out of
// range, is 400 validation naming the parameter in Field.
func Page(r *http.Request) (page, pageSize int, err error) {
	q := r.URL.Query()
	if page, err = intParam(q, "page", 1); err != nil {
		return 0, 0, err
	}
	if pageSize, err = intParam(q, "pageSize", 24); err != nil {
		return 0, 0, err
	}
	switch {
	case page < 1:
		return 0, 0, badParam("page", "must be at least 1")
	case pageSize < 1 || pageSize > 100:
		return 0, 0, badParam("pageSize", "must be from 1 to 100")
	}
	return page, pageSize, nil
}

// intParam returns the named query value, or def when the parameter is absent.
// A present but empty value is not a whole number. Values above MaxInt32 are
// refused too, so offset = (page-1)*pageSize cannot overflow.
func intParam(q url.Values, name string, def int) (int, error) {
	if !q.Has(name) {
		return def, nil
	}
	n, err := strconv.Atoi(q.Get(name))
	if err != nil || n > math.MaxInt32 {
		return 0, badParam(name, "must be a whole number")
	}
	return n, nil
}

func badParam(name, message string) *Error {
	return &Error{Status: http.StatusBadRequest, Code: "validation", Field: name, Message: message}
}
