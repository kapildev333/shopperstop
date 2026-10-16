// Package pg maps PostgreSQL errors to the API error envelope.
// Copied from services/core at 5335efc (D31).
package pg

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
)

// Map turns a database error into the API error the handler should return:
// no rows is 404 not_found, a unique violation (23505) is 409 conflict, a
// foreign key violation (23503) is 409 conflict. nil and any other error come
// back unchanged, so httpx.WriteError logs them as internal.
func Map(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return &httpx.Error{Status: http.StatusNotFound, Code: "not_found", Message: "not found"}
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "already exists"}
		case "23503":
			return &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "still in use"}
		}
	}
	return err
}

// IsUnique reports whether err is a unique violation (23505), so a handler can
// name the field that was taken.
func IsUnique(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
