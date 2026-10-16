package auth

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/kapildev333/shopperstop/services/core/internal/auth/db"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
)

// Customer is a customer as the API shows it. Phone is omitted when empty.
type Customer struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	Phone         string `json:"phone,omitempty"`
	EmailVerified bool   `json:"emailVerified"`
}

// customerSession is the body of register (201) and sign-in (200).
type customerSession struct {
	Token    string   `json:"token"`
	Customer Customer `json:"customer"`
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type signInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// customerPatch is the PATCH /me body; an absent field is nil and stays unchanged.
type customerPatch struct {
	Name  *string `json:"name"`
	Phone *string `json:"phone"`
}

var phonePattern = regexp.MustCompile(`^\+?[0-9]{10,15}$`)

// dummyHash is compared against when the email is unknown, so an unknown
// email costs the same bcrypt work as a wrong password (Decision 10).
var dummyHash = sync.OnceValue(func() string {
	h, err := HashPassword("no customer has this password")
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

// checkPasswordLength accepts 8 to 72 bytes; passwords are not trimmed.
func checkPasswordLength(password string) error {
	if len(password) < 8 || len(password) > 72 {
		return invalid("password", "must be 8 to 72 bytes")
	}
	return nil
}

// checkName returns the trimmed name when it is 1 to 100 characters.
func checkName(name string) (string, error) {
	n := strings.TrimSpace(name)
	if c := utf8.RuneCountInString(n); c < 1 || c > 100 {
		return "", invalid("name", "must be 1 to 100 characters")
	}
	return n, nil
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

// Register creates a customer and answers 201 with a session. Validation runs
// after the rate limiter counts the attempt, so refused input counts too.
func (a *Auth) Register(w http.ResponseWriter, r *http.Request) {
	var in registerRequest
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if a.refused(w, r, in.Email) {
		return
	}
	email, err := checkEmail(in.Email)
	if err == nil {
		err = checkPasswordLength(in.Password)
	}
	var name string
	if err == nil {
		name, err = checkName(in.Name)
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	hash, err := HashPassword(in.Password)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	ctx := r.Context()
	row, err := a.q.CreateCustomer(ctx, db.CreateCustomerParams{Email: email, PasswordHash: hash, Name: name})
	if pg.IsUnique(err) {
		httpx.WriteError(w, r, &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "email already registered", Field: "email"})
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	token, err := a.startSession(ctx, "customer", row.ID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, customerSession{
		Token:    token,
		Customer: Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone, EmailVerified: row.EmailVerified},
	})
}

// SignIn answers 200 with a new session. Every failure is the same 401, so the
// response does not say whether the email is registered.
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
	row, err := a.q.CustomerByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		checkPassword(dummyHash(), in.Password)
		httpx.WriteError(w, r, errWrongCredentials)
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if !checkPassword(row.PasswordHash, in.Password) {
		httpx.WriteError(w, r, errWrongCredentials)
		return
	}
	token, err := a.startSession(ctx, "customer", row.ID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, customerSession{
		Token:    token,
		Customer: Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone, EmailVerified: row.EmailVerified},
	})
}

// SignOut deletes the session of the bearer token and answers 204. It runs
// behind RequireCustomer, which has checked the token; the session id is looked
// up again because the middleware keeps only the customer id in the context.
func (a *Auth) SignOut(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	s, err := a.q.CustomerSession(ctx, a.tokenHash(bearer(r)))
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.WriteError(w, r, errUnauthorized)
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := a.q.DeleteSession(ctx, s.ID); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Me answers 200 with the signed-in customer.
func (a *Auth) Me(w http.ResponseWriter, r *http.Request) {
	row, err := a.q.CustomerByID(r.Context(), CustomerID(r.Context()))
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone, EmailVerified: row.EmailVerified})
}

// UpdateMe changes the fields present in the body and answers 200 with the
// customer. "" for phone clears it; null is refused by ReadPatch.
func (a *Auth) UpdateMe(w http.ResponseWriter, r *http.Request) {
	var in customerPatch
	if err := httpx.ReadPatch(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if in.Name != nil {
		name, err := checkName(*in.Name)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		in.Name = &name
	}
	if in.Phone != nil && *in.Phone != "" && !phonePattern.MatchString(*in.Phone) {
		httpx.WriteError(w, r, invalid("phone", "must be empty or 10 to 15 digits, optionally after +"))
		return
	}
	row, err := a.q.UpdateCustomer(r.Context(), db.UpdateCustomerParams{Name: in.Name, Phone: in.Phone, ID: CustomerID(r.Context())})
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone, EmailVerified: row.EmailVerified})
}

// CustomerByID answers the customer with this id, for placing an order; an
// unknown id is 404 not_found.
func CustomerByID(ctx context.Context, d db.DBTX, id string) (Customer, error) {
	row, err := db.New(d).CustomerByID(ctx, id)
	if err != nil {
		return Customer{}, pg.Map(err)
	}
	return Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone, EmailVerified: row.EmailVerified}, nil
}
