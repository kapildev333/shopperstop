package auth

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
)

// staffSession is the body of staff sign-in (200).
type staffSession struct {
	Token string `json:"token"`
	Staff Staff  `json:"staff"`
}

// StaffSignIn answers 200 with a new staff session. A wrong password, an unknown
// email, a customer's email and an inactive staff user all answer the same 401,
// and all of them pay one bcrypt compare (Decision 10).
func (a *Auth) StaffSignIn(w http.ResponseWriter, r *http.Request) {
	var in signInRequest
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if a.refused(w, r, in.Email) {
		return
	}
	email, err := checkEmail(in.Email)
	if err == nil && in.Password == "" {
		err = invalid("password", "is required")
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	ctx := r.Context()
	row, err := a.q.StaffByEmail(ctx, email)
	found := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.WriteError(w, r, err)
		return
	}
	hash := dummyHash()
	if found {
		hash = row.PasswordHash
	}
	if !checkPassword(hash, in.Password) || !found || !row.IsActive {
		httpx.WriteError(w, r, errWrongCredentials)
		return
	}
	token, err := a.startSession(ctx, "staff", row.ID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	staff := Staff{ID: row.ID, Email: row.Email, Name: row.Name, Role: string(row.Role), IsActive: row.IsActive}
	if row.StoreID != nil {
		staff.StoreID = *row.StoreID
	}
	httpx.WriteJSON(w, http.StatusOK, staffSession{Token: token, Staff: staff})
}

// StaffSignOut deletes the session of the bearer token and answers 204. It runs
// behind RequireStaff, which has checked the token; the session id is looked up
// again because the middleware keeps only the staff user in the context.
func (a *Auth) StaffSignOut(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	s, err := a.q.StaffSession(ctx, a.tokenHash(bearer(r)))
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.WriteError(w, r, errUnauthorized)
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := a.q.DeleteSession(ctx, s.SessionID); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// StaffMe answers 200 with the signed-in staff user.
func (a *Auth) StaffMe(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, CurrentStaff(r.Context()))
}
