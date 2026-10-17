// Package auth owns riders and their bearer sessions: password hashing, tokens,
// the RequireRider middleware, sign-in and sign-out, the sign-in rate limiter, and
// the admin rider routes behind RequireStaff (staff introspected through core).
// Copied from services/core/internal/auth at 5335efc (D31), adapted to riders.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/auth/db"
	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
)

// Auth holds what the handlers and middleware need.
type Auth struct {
	pool   *pgxpool.Pool
	q      *db.Queries
	pepper []byte
	limit  *Limiter
	core   *core.Client
}

// New returns the auth service over pool. pepper is mixed into every token hash;
// c answers staff introspection for the admin routes.
func New(pool *pgxpool.Pool, pepper string, limit *Limiter, c *core.Client) *Auth {
	return &Auth{pool: pool, q: db.New(pool), pepper: []byte(pepper), limit: limit, core: c}
}

// Rider is a rider as the API shows it. Phone is omitted when empty.
type Rider struct {
	ID       string `json:"id"`
	StoreID  string `json:"storeId"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Phone    string `json:"phone,omitempty"`
	IsActive bool   `json:"isActive"`
	IsOnline bool   `json:"isOnline"`
}

type riderKey struct{}

var errUnauthorized = &httpx.Error{Status: http.StatusUnauthorized, Code: "unauthorized", Message: "sign in required"}

// CurrentRider returns the signed-in rider, or the zero Rider outside RequireRider.
func CurrentRider(ctx context.Context) Rider {
	r, _ := ctx.Value(riderKey{}).(Rider)
	return r
}

// newToken returns 32 random bytes as unpadded base64url (43 characters).
func newToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

// tokenHash is sha256 over the token text followed by the pepper: the only form stored.
func (a *Auth) tokenHash(token string) []byte {
	sum := sha256.Sum256(append([]byte(token), a.pepper...))
	return sum[:]
}

// startSession deletes every expired session, then stores a new 30-day
// session for the rider and returns its token.
// ponytail: the sweep scans sessions on every sign-in (no index on expires_at);
// add the index or a periodic sweep if sign-ins or live sessions grow large.
func (a *Auth) startSession(ctx context.Context, riderID string) (string, error) {
	if err := a.q.DeleteExpiredSessions(ctx); err != nil {
		return "", err
	}
	token, err := newToken()
	if err != nil {
		return "", err
	}
	if err := a.q.CreateSession(ctx, db.CreateSessionParams{TokenHash: a.tokenHash(token), RiderID: riderID}); err != nil {
		return "", err
	}
	return token, nil
}

// Bearer returns the token of an "Authorization: Bearer <token>" header, or "".
func Bearer(r *http.Request) string {
	scheme, token, ok := strings.Cut(r.Header.Get("Authorization"), " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return token
}

// RequireRider admits a live session of an active rider. The last use is
// written at most once an hour, and the expiry moves with it.
func (a *Auth) RequireRider(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		token := Bearer(r)
		if token == "" {
			httpx.WriteError(w, r, errUnauthorized)
			return
		}
		s, err := a.q.RiderSession(ctx, a.tokenHash(token))
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, errUnauthorized)
			return
		}
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if err := a.q.TouchSession(ctx, s.SessionID); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		rider := Rider{ID: s.ID, StoreID: s.StoreID, Email: s.Email, Name: s.Name, Phone: s.Phone, IsActive: s.IsActive, IsOnline: s.IsOnline}
		httpx.SetSubject(ctx, "rider", rider.ID)
		next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, riderKey{}, rider)))
	})
}
