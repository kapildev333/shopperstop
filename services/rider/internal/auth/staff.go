package auth

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/auth/db"
	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
	"github.com/kapildev333/shopperstop/services/rider/internal/pg"
)

// The admin routes: staff are core's staff users, introspected through the
// core client (D30). Admins act on every store; store staff on their own (D7).

type staffKey struct{}

var errNotFound = &httpx.Error{Status: http.StatusNotFound, Code: "not_found", Message: "not found"}

// CurrentStaff returns the signed-in staff user, or the zero Staff outside RequireStaff.
func CurrentStaff(ctx context.Context) core.Staff {
	s, _ := ctx.Value(staffKey{}).(core.Staff)
	return s
}

// RequireStaff admits a bearer token that core answers as a staff user. No
// token is 401 before any core call. Core's 401 is the caller's 401; any other
// core failure is the 502 the core client returns.
func (a *Auth) RequireStaff(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		token := Bearer(r)
		if token == "" {
			httpx.WriteError(w, r, errUnauthorized)
			return
		}
		s, err := a.core.StaffFromToken(ctx, token)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		httpx.SetSubject(ctx, "staff", s.ID)
		next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, staffKey{}, s)))
	})
}

// inScope reports whether the staff user may act on riders of storeID.
func inScope(s core.Staff, storeID string) bool {
	return s.Role == "admin" || strings.EqualFold(s.StoreID, storeID)
}

// riderOf is the API view of one rider row.
func riderOf(id, storeID, email, name, phone string, active, online bool) Rider {
	return Rider{ID: id, StoreID: storeID, Email: email, Name: name, Phone: phone, IsActive: active, IsOnline: online}
}

// NewRider is a rider to create. Phone is optional; the rest are required.
type NewRider struct {
	StoreID  string `json:"storeId"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

// riderPatch is the PATCH body; an absent field is nil and stays unchanged.
// storeId and email cannot change.
type riderPatch struct {
	Name     *string `json:"name"`
	Phone    *string `json:"phone"`
	IsActive *bool   `json:"isActive"`
	Password *string `json:"password"`
}

var phonePattern = regexp.MustCompile(`^\+?[0-9]{10,15}$`)

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

// checkPhone accepts an empty phone (none) or 10 to 15 digits, optionally after +.
func checkPhone(phone string) error {
	if phone != "" && !phonePattern.MatchString(phone) {
		return invalid("phone", "must be empty or 10 to 15 digits, optionally after +")
	}
	return nil
}

// CreateRider validates the fields as core validates a customer's, checks the
// store with core, hashes the password at cost 12 and inserts an active rider.
// The field checks run first, so a bad field never costs a core request.
// Refusals are *httpx.Error: 400 naming the field (storeId when core does not
// know the store), 409 conflict on email when it is taken in any case, or the
// 502 of a core failure. Shared by the admin route and rider-admin create-rider.
func CreateRider(ctx context.Context, pool *pgxpool.Pool, c *core.Client, in NewRider) (Rider, error) {
	email, err := checkEmail(in.Email)
	if err != nil {
		return Rider{}, err
	}
	name, err := checkName(in.Name)
	if err != nil {
		return Rider{}, err
	}
	if err := checkPhone(in.Phone); err != nil {
		return Rider{}, err
	}
	if err := checkPasswordLength(in.Password); err != nil {
		return Rider{}, err
	}
	if _, err := c.Store(ctx, in.StoreID); errors.Is(err, core.ErrNotFound) {
		return Rider{}, invalid("storeId", "no such store")
	} else if err != nil {
		return Rider{}, err
	}
	hash, err := HashPassword(in.Password)
	if err != nil {
		return Rider{}, err
	}
	row, err := db.New(pool).CreateRider(ctx, db.CreateRiderParams{
		StoreID: in.StoreID, Email: email, Name: name, Phone: in.Phone, PasswordHash: hash,
	})
	if pg.IsUnique(err) {
		return Rider{}, &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "email already registered", Field: "email"}
	}
	if err != nil {
		return Rider{}, err
	}
	return riderOf(row.ID, row.StoreID, row.Email, row.Name, row.Phone, row.IsActive, row.IsOnline), nil
}

// ListRiders answers one page of riders ordered by email: every store's for an
// admin, the store named by store, or else the staff user's own store. A store
// that is not a uuid is 400 on store; another store than the staff user's is 403.
func (a *Auth) ListRiders(w http.ResponseWriter, r *http.Request) {
	staff := CurrentStaff(r.Context())
	page, pageSize, err := httpx.Page(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	var store *string
	if staff.Role != "admin" {
		store = &staff.StoreID
	}
	if r.URL.Query().Has("store") {
		id := r.URL.Query().Get("store")
		if !httpx.IsUUID(id) {
			httpx.WriteError(w, r, invalid("store", "must be a store id"))
			return
		}
		if !inScope(staff, id) {
			httpx.WriteError(w, r, &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "store staff list their own store only"})
			return
		}
		store = &id
	}
	ctx := r.Context()
	total, err := a.q.CountRiders(ctx, store)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	rows, err := a.q.ListRiders(ctx, db.ListRidersParams{StoreID: store, PageLimit: int32(pageSize), PageOffset: int32((page - 1) * pageSize)})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]Rider, 0, len(rows))
	for _, row := range rows {
		items = append(items, riderOf(row.ID, row.StoreID, row.Email, row.Name, row.Phone, row.IsActive, row.IsOnline))
	}
	httpx.WriteJSON(w, http.StatusOK, httpx.NewList(items, page, pageSize, total))
}

// AdminCreateRider answers 201 with the new rider. Store staff may create only
// at their own store (403 otherwise), checked after storeId's shape.
func (a *Auth) AdminCreateRider(w http.ResponseWriter, r *http.Request) {
	var in NewRider
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if !httpx.IsUUID(in.StoreID) {
		httpx.WriteError(w, r, invalid("storeId", "must be a store id"))
		return
	}
	if !inScope(CurrentStaff(r.Context()), in.StoreID) {
		httpx.WriteError(w, r, &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "store staff create riders at their own store only"})
		return
	}
	rider, err := CreateRider(r.Context(), a.pool, a.core, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, rider)
}

// AdminGetRider answers the rider in the path. A rider of another store is
// 404, as an unknown id is.
func (a *Auth) AdminGetRider(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	row, err := a.q.RiderByID(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	if !inScope(CurrentStaff(r.Context()), row.StoreID) {
		httpx.WriteError(w, r, errNotFound)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, riderOf(row.ID, row.StoreID, row.Email, row.Name, row.Phone, row.IsActive, row.IsOnline))
}

// AdminUpdateRider changes name, phone (empty clears it), isActive and password
// of the rider in the path and answers 200 with it. The row is locked for the
// update; setting isActive false takes the rider offline (UpdateRider clears
// is_online, after LockDispatch as the first statement) and deletes the rider's
// sessions and expires their open offer in the same transaction. Another store's rider is 404.
func (a *Auth) AdminUpdateRider(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	var in riderPatch
	if err := httpx.ReadPatch(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	p := db.UpdateRiderParams{ID: id, IsActive: in.IsActive}
	if in.Name != nil {
		name, err := checkName(*in.Name)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		p.Name = &name
	}
	if in.Phone != nil {
		if err := checkPhone(*in.Phone); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		p.Phone = in.Phone
	}
	if in.Password != nil {
		if err := checkPasswordLength(*in.Password); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		hash, err := HashPassword(*in.Password)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		p.PasswordHash = &hash
	}
	ctx := r.Context()
	staff := CurrentStaff(ctx)
	deactivate := in.IsActive != nil && !*in.IsActive
	var row db.UpdateRiderRow
	err = pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		if deactivate {
			// Before LockRider: the tick's offer insert takes a key-share lock on the rider row.
			if err := q.LockDispatch(ctx); err != nil {
				return err
			}
		}
		locked, err := q.LockRider(ctx, id)
		if err != nil {
			return err
		}
		if !inScope(staff, locked.StoreID) {
			return errNotFound
		}
		row, err = q.UpdateRider(ctx, p)
		if err != nil {
			return err
		}
		if !deactivate {
			return nil
		}
		if err := q.DeleteRiderSessions(ctx, id); err != nil {
			return err
		}
		return q.ExpireRiderOffers(ctx, id)
	})
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, riderOf(row.ID, row.StoreID, row.Email, row.Name, row.Phone, row.IsActive, row.IsOnline))
}
