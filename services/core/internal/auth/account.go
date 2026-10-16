package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/kapildev333/shopperstop/services/core/internal/auth/db"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
)

// Purposes of a mailed token (customer_tokens.purpose). A token works only for its own.
const (
	purposeVerifyEmail   = "verify_email"
	purposeResetPassword = "reset_password"
)

var (
	errBadToken        = invalid("token", "invalid or expired token")
	errAlreadyVerified = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "email already verified"}
)

type tokenRequest struct {
	Token string `json:"token"`
}

type passwordResetRequest struct {
	Email string `json:"email"`
}

type passwordResetConfirm struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// mailToken issues a 24-hour token for the customer and purpose, replacing any
// earlier one of that purpose, and mails it as the last word of the body.
func (a *Auth) mailToken(ctx context.Context, customerID, email, purpose, subject, text string) error {
	token, err := newToken()
	if err != nil {
		return err
	}
	if err := a.q.IssueCustomerToken(ctx, db.IssueCustomerTokenParams{
		TokenHash: a.tokenHash(token), CustomerID: customerID, Purpose: purpose,
	}); err != nil {
		return err
	}
	return a.Mailer.Send(ctx, Mail{To: email, Subject: subject, Body: text + " " + token})
}

// consumeToken deletes the live token of this purpose in tx and returns its
// customer; an empty, unknown, used or expired token is 400 field token.
func (a *Auth) consumeToken(ctx context.Context, q *db.Queries, token, purpose string) (string, error) {
	if token == "" {
		return "", invalid("token", "is required")
	}
	id, err := q.ConsumeCustomerToken(ctx, db.ConsumeCustomerTokenParams{TokenHash: a.tokenHash(token), Purpose: purpose})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errBadToken
	}
	return id, err
}

// SendEmailVerification mails the signed-in customer a verification token and
// answers 202; a customer already verified gets 409 and no mail.
func (a *Auth) SendEmailVerification(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	row, err := a.q.CustomerByID(ctx, CustomerID(ctx))
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	if row.EmailVerified {
		httpx.WriteError(w, r, errAlreadyVerified)
		return
	}
	if err := a.mailToken(ctx, row.ID, row.Email, purposeVerifyEmail,
		"Verify your ShopperStop email", "Use this code within 24 hours to verify your email:"); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

// VerifyEmail spends a verification token, marks its customer's email
// verified and answers 204. No session is needed: the token is the proof.
func (a *Auth) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var in tokenRequest
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	ctx := r.Context()
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		id, err := a.consumeToken(ctx, q, in.Token, purposeVerifyEmail)
		if err != nil {
			return err
		}
		return q.VerifyCustomerEmail(ctx, id)
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// RequestPasswordReset mails a reset token when the email is a customer's and
// answers 202 either way, so the answer never says whether it is registered.
// Attempts count against ResetLimit, not the sign-in limiter. A failure to
// issue or mail the token for a registered email is logged, without the
// token, and still answers 202.
// ponytail: an unknown email answers sooner (no insert, no mail); a queued
// mailer that sends after the answer closes the gap.
func (a *Auth) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var in passwordResetRequest
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if refused(w, r, a.ResetLimit, in.Email) {
		return
	}
	email, err := checkEmail(in.Email)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	ctx := r.Context()
	row, err := a.q.CustomerByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		w.WriteHeader(http.StatusAccepted)
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := a.mailToken(ctx, row.ID, row.Email, purposeResetPassword,
		"Reset your ShopperStop password", "Use this code within 24 hours to set a new password:"); err != nil {
		slog.ErrorContext(ctx, "password reset mail not sent", "customerId", row.ID, "err", err)
	}
	w.WriteHeader(http.StatusAccepted)
}

// ConfirmPasswordReset spends a reset token, sets the new password (the
// register rules), marks the email verified, ends every session of the
// customer, and answers 204, all in one transaction. A bad password is
// refused before the token is spent; the hash runs only for a live token.
func (a *Auth) ConfirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	var in passwordResetConfirm
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := checkPasswordLength(in.Password); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	ctx := r.Context()
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		id, err := a.consumeToken(ctx, q, in.Token, purposeResetPassword)
		if err != nil {
			return err
		}
		hash, err := HashPassword(in.Password)
		if err != nil {
			return err
		}
		if err := q.ResetCustomerPassword(ctx, db.ResetCustomerPasswordParams{ID: id, PasswordHash: hash}); err != nil {
			return err
		}
		return q.DeleteCustomerSessions(ctx, id)
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
