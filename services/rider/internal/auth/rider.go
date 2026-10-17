package auth

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/mail"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5"

	"github.com/kapildev333/shopperstop/services/rider/internal/auth/db"
	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
)

// riderSession is the body of sign-in (200).
type riderSession struct {
	Token string `json:"token"`
	Rider Rider  `json:"rider"`
}

type signInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// dummyHash is compared against when the email is unknown, so an unknown
// email costs the same bcrypt work as a wrong password (core's Decision 10).
var dummyHash = sync.OnceValue(func() string {
	h, err := HashPassword("no rider has this password")
	if err != nil {
		panic(err)
	}
	return h
})

var errWrongCredentials = &httpx.Error{Status: http.StatusUnauthorized, Code: "unauthorized", Message: "wrong email or password"}

func invalid(field, message string) *httpx.Error {
	return &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: field, Message: message}
}

// checkEmail returns the trimmed email when it is one address of at most 254 bytes.
func checkEmail(email string) (string, error) {
	e := strings.TrimSpace(email)
	if len(e) == 0 || len(e) > 254 {
		return "", invalid("email", "must be a valid email address")
	}
	if addr, err := mail.ParseAddress(e); err != nil || addr.Address != e {
		return "", invalid("email", "must be a valid email address")
	}
	return e, nil
}

// refused answers 429 and reports true when the attempt is over the limit.
// A nil limiter admits every attempt.
func (a *Auth) refused(w http.ResponseWriter, r *http.Request, email string) bool {
	if a.limit == nil || a.limit.Allow(email, clientIP(r, a.limit.TrustProxy)) {
		return false
	}
	httpx.WriteError(w, r, &httpx.Error{Status: http.StatusTooManyRequests, Code: "rate_limited", Message: "too many attempts, try again later"})
	return true
}

// clientIP is the first X-Forwarded-For address when trustProxy is set and
// the header names one, otherwise the host part of RemoteAddr, without the port.
func clientIP(r *http.Request, trustProxy bool) string {
	if trustProxy {
		first, _, _ := strings.Cut(r.Header.Get("X-Forwarded-For"), ",")
		if first = strings.TrimSpace(first); first != "" {
			return first
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// SignIn answers 200 with a new session, leaving the rider's other sessions
// alone. A wrong password, an unknown email and an inactive rider all answer
// the same 401 and all pay one bcrypt compare.
func (a *Auth) SignIn(w http.ResponseWriter, r *http.Request) {
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
	row, err := a.q.RiderByEmail(ctx, email)
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
	token, err := a.startSession(ctx, row.ID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	rider := Rider{ID: row.ID, StoreID: row.StoreID, Email: row.Email, Name: row.Name, Phone: row.Phone, IsActive: row.IsActive, IsOnline: row.IsOnline}
	httpx.WriteJSON(w, http.StatusOK, riderSession{Token: token, Rider: rider})
}

// SignOut deletes the session of the bearer token, takes the rider offline as
// going offline does, and answers 204. It runs behind RequireRider, which has
// checked the token; the session id is looked up again because the middleware
// keeps only the rider in the context.
func (a *Auth) SignOut(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	s, err := a.q.RiderSession(ctx, a.tokenHash(Bearer(r)))
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.WriteError(w, r, errUnauthorized)
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	err = pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		if _, err := goOffline(ctx, q, s.ID); err != nil {
			return err
		}
		return q.DeleteSession(ctx, s.SessionID)
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Me answers 200 with the signed-in rider.
func (a *Auth) Me(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, CurrentRider(r.Context()))
}

type availabilityRequest struct {
	Online *bool `json:"online"`
}

// goOffline waits for a running dispatcher tick (LockDispatch, the first
// statement of the transaction), sets the rider offline and expires their open
// offer, so no tick can offer to a rider who is offline. q must be in a transaction.
func goOffline(ctx context.Context, q *db.Queries, riderID string) (db.SetAvailabilityRow, error) {
	if err := q.LockDispatch(ctx); err != nil {
		return db.SetAvailabilityRow{}, err
	}
	row, err := q.SetAvailability(ctx, db.SetAvailabilityParams{Online: false, ID: riderID})
	if err != nil {
		return db.SetAvailabilityRow{}, err
	}
	return row, q.ExpireRiderOffers(ctx, riderID)
}

// PutAvailability sets the signed-in rider online or offline and answers 200
// with the rider. Going online keeps online_since while the rider stays online;
// going offline is goOffline in one transaction.
func (a *Auth) PutAvailability(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in availabilityRequest
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if in.Online == nil {
		httpx.WriteError(w, r, invalid("online", "is required"))
		return
	}
	id := CurrentRider(ctx).ID
	var row db.SetAvailabilityRow
	var err error
	if *in.Online {
		row, err = a.q.SetAvailability(ctx, db.SetAvailabilityParams{Online: true, ID: id})
	} else {
		err = pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
			var err error
			row, err = goOffline(ctx, a.q.WithTx(tx), id)
			return err
		})
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, riderOf(row.ID, row.StoreID, row.Email, row.Name, row.Phone, row.IsActive, row.IsOnline))
}
