## Context

`auth.UpdateStaffUser` (`services/core/internal/auth/staff.go`) validates the patch, hashes a new password, then runs the single statement `UpdateStaff` (`queries/auth.sql`). Nothing counts admins. `core-accounts-auth` Decision 19 allowed self-deactivation with `core-admin create-admin` as the recovery; this change keeps self-deactivation while another admin is active and refuses it for the last one.

A plain `update ... where not (only active admin)` is not enough: under READ COMMITTED two admins deactivating each other both see two active admins and both succeed.

## Goals / Non-Goals

**Goals:** the last active admin cannot be deactivated through the API, also under concurrency; nothing else in the PATCH changes.

**Non-Goals:** a database constraint or trigger; guarding `core-admin` or `seed-demo` (they run on the shell, which is the recovery path); role changes; the backlog items of the request.

## Decisions

### 1. Lock the active admins, in id order, in the patch's transaction

When the patch carries `isActive: false`, the handler opens a transaction, locks every active admin row with `select id from staff_users where role = 'admin' and is_active order by id for update`, refuses when the result is exactly the target id, and runs the existing `UpdateStaff` on the same transaction. Two concurrent deactivations take the same rows in the same order, so the second waits and then re-reads the rows (or, if it arrives after the first committed, `RequireStaff` already answers 401 because its own admin is inactive); the admin the first one deactivated drops out of its result, it sees one row (itself as target) and answers 409. Same order means no deadlock (rule from core-P2-L5: sort in SQL, never in Go).

Patches without `isActive: false` (name or password only, or `isActive: true`) skip the lock, but go through the same transaction for one code path.

Alternatives: `pg_advisory_xact_lock` (one global key, also correct, but a magic number shared by nobody else); `serializable` isolation (needs a retry loop); a constraint trigger (more SQL than the rule is worth).

Ceiling: every deactivation of any staff user takes a row lock on every active admin. With a handful of admins this is nothing; if admins ever number in the thousands, lock only when the target is an active admin (one extra select first).

### 2. The id is compared without regard to case

`httpx.PathID` accepts a canonical uuid in either case, Postgres returns lowercase. The comparison is `strings.EqualFold(admins[0], id)`; a plain `==` would let an uppercase id bypass the guard. The test patches with the uppercase id too.

### 3. The refusal is 409 `conflict` with field `isActive`

`conflict` is the existing code for "the request is valid but the current state forbids it" (taken email, order transitions). Field `isActive` lets the panel put the message next to the switch. Message: `cannot deactivate the last active admin`. The whole patch is refused: a name sent with it is not saved, because the transaction rolls back before `UpdateStaff` runs.

### Code (verbatim)

`services/core/queries/auth.sql`, appended after `UpdateStaff`:

```sql
-- name: LockActiveAdmins :many
-- Locks the active admins in id order so concurrent deactivations serialise without deadlock.
select id from staff_users where role = 'admin' and is_active order by id for update;
```

Then `make gen` regenerates `internal/auth/db/auth.sql.go` (adds `LockActiveAdmins(ctx) ([]string, error)`).

`services/core/internal/auth/staff.go`: add the import `"strings"` (`pgx` is already imported). Next to `staffPatch`:

```go
// errLastAdmin refuses a patch that would leave no active admin.
var errLastAdmin = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "cannot deactivate the last active admin", Field: "isActive"}
```

In `UpdateStaffUser`, replace

```go
	row, err := a.q.UpdateStaff(r.Context(), p)
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
```

with

```go
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
```

`pg.Map` returns `*httpx.Error` unchanged and still maps no rows to 404. Update the function's doc comment: add "Setting isActive false on the only active admin answers 409 and changes nothing."

`services/core/openapi.json`, operation `patchStaffUser`:
- In `description`, replace `An admin may deactivate their own account; core-admin create-admin with another email makes a new admin.` with `An admin may deactivate their own account while another admin is active; deactivating the only active admin answers 409 and changes nothing (core-admin create-admin with another email makes a new admin).`
- Add after `"404"`:

```json
"409": {
  "description": "The patch sets isActive false on the only active admin. Nothing is changed.",
  "content": {
    "application/json": {
      "schema": { "$ref": "#/components/schemas/Error" },
      "example": { "error": { "code": "conflict", "message": "cannot deactivate the last active admin", "field": "isActive" } }
    }
  }
}
```

(formatted like the neighbouring responses: two-space indent, one key per line).

### Tests (`services/core/internal/app/staff_test.go`)

The package's tests share one schema and run one at a time (no `t.Parallel` in `internal/app`). A helper makes "only these admins are active" true for one test and undoes it:

```go
// onlyActiveAdmins deactivates every active admin whose email is not in keep,
// and reactivates them when the test ends.
func onlyActiveAdmins(t *testing.T, keep ...string) {
	t.Helper()
	ctx := context.Background()
	rows, err := testPool.Query(ctx,
		"update staff_users set is_active = false where role = 'admin' and is_active and email::text <> all($1::text[]) returning id", keep)
	if err != nil {
		t.Fatal(err)
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := testPool.Exec(ctx, "update staff_users set is_active = true where id = any($1)", ids); err != nil {
			t.Error(err)
		}
	})
}

// activeAdmins counts the active admins.
func activeAdmins(t *testing.T) int {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(), "select count(*) from staff_users where role = 'admin' and is_active").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}
```

(`staff_test.go` gains the import `github.com/jackc/pgx/v5`.)

| Scenario | Test | Steps | At red |
|---|---|---|---|
| Last active admin cannot be deactivated | `TestDeactivateLastActiveAdmin` | `a := insertStaff(t, "admin", true)`; `onlyActiveAdmins(t, a)`; `token := staffSignIn(t, a)`; PATCH `staffUsersPath+"/"+id` with `{"name":"Renamed","isActive":false}` → 409, `code` `conflict`, `field` `isActive`; PATCH again at `staffUsersPath+"/"+strings.ToUpper(id)` with `{"isActive":false}` → 409 `conflict`; `GET /api/core/v1/admin/me` with `token` → 200, `isActive` true, `name` `Staff` (decode into `staffView`) | fails (200) |
| One of two active admins is deactivated | `TestDeactivateOneOfTwoAdmins` | `a`, `b` inserted active admins; `onlyActiveAdmins(t, a, b)`; `a`'s token PATCHes `b`'s id with `{"isActive":false}` → 200 with `isActive` false (`staffUserBody`) | passes (guard against over-refusal) |
| Two admins deactivate each other at once | `TestAdminsDeactivateEachOtherAtOnce` | `for range 20`: insert `a`, `b`; `onlyActiveAdmins(t, a, b)`; sign both in; the `start` channel and `sync.WaitGroup` pattern of `TestCartSetSurvivesConcurrentRemoval` (`cart_test.go`): `a` PATCHes `b` and `b` PATCHes `a` with `{"isActive":false}`; exactly one status is 200, the other is 409 with code `conflict` or 401 with code `unauthorized` (keep both bodies; decode the loser's with `decodeError`); `activeAdmins(t) == 1`; the failure message prints both statuses and bodies | fails (both 200, 0 active): 5 of 5 runs in the team lead's spike |
| Store staff and inactive users are not guarded | `TestLastAdminDeactivatesStaffAndInactive` | `a` active admin; `onlyActiveAdmins(t, a)`; `s := insertStaff(t, "store_staff", true)`; `i := insertStaff(t, "admin", false)`; `a`'s token PATCHes `s` then `i` with `{"isActive":false}` → each 200 with `isActive` false; `activeAdmins(t) == 1` | passes |

Existing tests unchanged and still green: `TestAdminDeactivatesSelf` (the seeded admin stays active, so self-deactivation of a second admin is 200), `TestDeactivatedWhileSignedIn`, `TestPatchUnknownStaff`, `TestPatchStaffUserRules`, the contract test (the new 409 carries an example).

## Risks / Trade-offs

- The concurrency test can pass at red by luck of timing; 20 rounds make that unlikely (the spike failed 5 of 5 at red, passed 5 of 5 at green under `-race`). Accepted.
- The loser of the race answers 409 when its request passes `RequireStaff` before the winner commits, and 401 when it arrives after (its own session is already dead). Both are refusals; the scenario accepts either. Making it always 409 would need the middleware inside the lock, which is not worth it.
- `core-admin` and `seed-demo --reset` are not guarded: they are the recovery path and run with shell access.
- Ceiling of Decision 1 (lock all active admins on any deactivation) as named there.
