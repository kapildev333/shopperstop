// Package auth owns customers, staff users and their bearer sessions: password
// hashing, tokens, the Require middleware and the sign-in rate limiter.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth/db"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
)

// Auth holds what the handlers and middleware need.
type Auth struct {
	pool   *pgxpool.Pool
	q      *db.Queries
	pepper []byte
	limit  *Limiter
}

// New returns the auth service over pool. pepper is mixed into every token hash.
func New(pool *pgxpool.Pool, pepper string, limit *Limiter) *Auth {
	return &Auth{pool: pool, q: db.New(pool), pepper: []byte(pepper), limit: limit}
}

// Staff is the signed-in staff user, as the context and the staff routes see it.
type Staff struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	StoreID  string `json:"storeId,omitempty"`
	IsActive bool   `json:"isActive"`
}

type customerKey struct{}
type staffKey struct{}

var (
	errUnauthorized = &httpx.Error{Status: http.StatusUnauthorized, Code: "unauthorized", Message: "sign in required"}
	errAdminsOnly   = &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "admins only"}
)

// CustomerID returns the signed-in customer's id, or "" outside RequireCustomer.
func CustomerID(ctx context.Context) string {
	id, _ := ctx.Value(customerKey{}).(string)
	return id
}

// CurrentStaff returns the signed-in staff user, or the zero Staff outside RequireStaff.
func CurrentStaff(ctx context.Context) Staff {
	s, _ := ctx.Value(staffKey{}).(Staff)
	return s
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

// startSession stores a new session for the subject and returns its token.
func (a *Auth) startSession(ctx context.Context, subjectType, subjectID string) (string, error) {
	token, err := newToken()
	if err != nil {
		return "", err
	}
	hash := a.tokenHash(token)
	switch subjectType {
	case "customer":
		err = a.q.CreateCustomerSession(ctx, db.CreateCustomerSessionParams{TokenHash: hash, SubjectID: subjectID})
	case "staff":
		err = a.q.CreateStaffSession(ctx, db.CreateStaffSessionParams{TokenHash: hash, SubjectID: subjectID})
	default:
		err = fmt.Errorf("unknown session subject %q", subjectType)
	}
	if err != nil {
		return "", err
	}
	return token, nil
}

// bearer returns the token of an "Authorization: Bearer <token>" header, or "".
func bearer(r *http.Request) string {
	scheme, token, ok := strings.Cut(r.Header.Get("Authorization"), " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return token
}

// RequireCustomer admits a live customer session. A customer session slides:
// the last use is written at most once an hour, and the expiry moves with it.
func (a *Auth) RequireCustomer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		token := bearer(r)
		if token == "" {
			httpx.WriteError(w, r, errUnauthorized)
			return
		}
		s, err := a.q.CustomerSession(ctx, a.tokenHash(token))
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, errUnauthorized)
			return
		}
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if err := a.q.TouchCustomerSession(ctx, s.ID); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		httpx.SetSubject(ctx, "customer", s.SubjectID)
		next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, customerKey{}, s.SubjectID)))
	})
}

// RequireStaff admits a session of an active staff user. Staff sessions are
// fixed: use never moves their expiry, and deactivation ends them at once.
func (a *Auth) RequireStaff(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		token := bearer(r)
		if token == "" {
			httpx.WriteError(w, r, errUnauthorized)
			return
		}
		s, err := a.q.StaffSession(ctx, a.tokenHash(token))
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, errUnauthorized)
			return
		}
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		staff := Staff{ID: s.ID, Email: s.Email, Name: s.Name, Role: string(s.Role), IsActive: s.IsActive}
		if s.StoreID != nil {
			staff.StoreID = *s.StoreID
		}
		httpx.SetSubject(ctx, "staff", s.ID)
		next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, staffKey{}, staff)))
	})
}

// RequireAdmin is RequireStaff for admins only; store staff get 403 forbidden.
func (a *Auth) RequireAdmin(next http.Handler) http.Handler {
	return a.RequireStaff(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if CurrentStaff(r.Context()).Role != string(db.StaffRoleAdmin) {
			httpx.WriteError(w, r, errAdminsOnly)
			return
		}
		next.ServeHTTP(w, r)
	}))
}
