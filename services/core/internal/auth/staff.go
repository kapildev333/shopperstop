package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth/db"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
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
// behind RequireStaff, which has checked the token; the session id is looked
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

// NewStaff is a staff user to create. Role is admin or store_staff; StoreID
// is required for store staff and must be empty for an admin.
type NewStaff struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	StoreID  string `json:"storeId"`
}

// staffPatch is the PATCH /admin/staff-users/{id} body; an absent field is nil and stays unchanged.
type staffPatch struct {
	Name     *string `json:"name"`
	Password *string `json:"password"`
	IsActive *bool   `json:"isActive"`
}

// errLastAdmin refuses a patch that would leave no active admin.
var errLastAdmin = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "cannot deactivate the last active admin", Field: "isActive"}

// checkRole returns the store id to store (nil for an admin) when role and storeId agree.
func checkRole(role, storeID string) (*string, error) {
	switch role {
	case "admin":
		if storeID != "" {
			return nil, invalid("storeId", "must be omitted for an admin")
		}
		return nil, nil
	case "store_staff":
		if !httpx.IsUUID(storeID) {
			return nil, invalid("storeId", "must be a store id for store staff")
		}
		return &storeID, nil
	default:
		return nil, invalid("role", "must be admin or store_staff")
	}
}

// staffFrom is the API view of one staff row.
func staffFrom(id, email, name, role string, storeID *string, active bool) Staff {
	s := Staff{ID: id, Email: email, Name: name, Role: role, IsActive: active}
	if storeID != nil {
		s.StoreID = *storeID
	}
	return s
}

// CreateStaff validates in, hashes the password at cost 12 and inserts the
// staff user. Refusals are *httpx.Error: 400 validation naming the field, or
// 409 conflict on email when the email is taken in any case. Shared by the
// admin route, create-admin and tests.
func CreateStaff(ctx context.Context, pool *pgxpool.Pool, in NewStaff) (Staff, error) {
	email, err := checkEmail(in.Email)
	if err == nil {
		err = checkPasswordLength(in.Password)
	}
	var name string
	if err == nil {
		name, err = checkName(in.Name)
	}
	var storeID *string
	if err == nil {
		storeID, err = checkRole(in.Role, in.StoreID)
	}
	if err != nil {
		return Staff{}, err
	}
	hash, err := HashPassword(in.Password)
	if err != nil {
		return Staff{}, err
	}
	row, err := db.New(pool).CreateStaff(ctx, db.CreateStaffParams{
		Email: email, PasswordHash: hash, Name: name, Role: db.StaffRole(in.Role), StoreID: storeID,
	})
	var fk *pgconn.PgError
	if errors.As(err, &fk) && fk.ConstraintName == "staff_users_store_id_fkey" {
		return Staff{}, &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Message: "no such store", Field: "storeId"}
	}
	if pg.IsUnique(err) {
		return Staff{}, &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "email already registered", Field: "email"}
	}
	if err != nil {
		return Staff{}, err
	}
	return staffFrom(row.ID, row.Email, row.Name, string(row.Role), row.StoreID, row.IsActive), nil
}

// CreateStaffUser answers 201 with the new staff user.
func (a *Auth) CreateStaffUser(w http.ResponseWriter, r *http.Request) {
	var in NewStaff
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	staff, err := CreateStaff(r.Context(), a.pool, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, staff)
}

// ListStaff answers one page of staff users ordered by email.
func (a *Auth) ListStaff(w http.ResponseWriter, r *http.Request) {
	page, pageSize, err := httpx.Page(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	ctx := r.Context()
	total, err := a.q.CountStaff(ctx)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	rows, err := a.q.ListStaff(ctx, db.ListStaffParams{Limit: int32(pageSize), Offset: int32((page - 1) * pageSize)})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]Staff, 0, len(rows))
	for _, row := range rows {
		items = append(items, staffFrom(row.ID, row.Email, row.Name, string(row.Role), row.StoreID, row.IsActive))
	}
	httpx.WriteJSON(w, http.StatusOK, httpx.NewList(items, page, pageSize, total))
}

// UpdateStaffUser changes the name, the password (hashed at cost 12) and
// isActive of the staff user in the path, and answers 200 with it. The role and
// the store cannot change. An unknown id answers 404. Setting isActive false on
// the only active admin answers 409 and changes nothing.
func (a *Auth) UpdateStaffUser(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	var in staffPatch
	if err := httpx.ReadPatch(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	p := db.UpdateStaffParams{ID: id, IsActive: in.IsActive}
	if in.Name != nil {
		name, err := checkName(*in.Name)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		p.Name = &name
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
	var row db.UpdateStaffRow
	err = pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		if in.IsActive != nil && !*in.IsActive {
			admins, err := q.LockActiveAdmins(ctx)
			if err != nil {
				return err
			}
			if len(admins) == 1 && strings.EqualFold(admins[0], id) {
				return errLastAdmin
			}
		}
		updated, err := q.UpdateStaff(ctx, p)
		row = updated
		return err
	})
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, staffFrom(row.ID, row.Email, row.Name, string(row.Role), row.StoreID, row.IsActive))
}
