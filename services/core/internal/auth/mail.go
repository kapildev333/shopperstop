package auth

import (
	"context"
	"log/slog"
)

// Mail is one message to one address.
type Mail struct {
	To      string
	Subject string
	Body    string
}

// Mailer sends mail. Core has no mail transport yet: mail is a process
// boundary, so the service logs it (LogMailer) and tests capture it.
type Mailer interface {
	Send(ctx context.Context, m Mail) error
}

// LogMailer writes every message, its token included, to the log at info.
// ponytail: development only, the log carries live tokens; a real transport
// (SMTP or a provider's API) replaces it before core serves real customers.
type LogMailer struct{}

// Send logs m and never fails.
func (LogMailer) Send(ctx context.Context, m Mail) error {
	slog.InfoContext(ctx, "mail", "to", m.To, "subject", m.Subject, "body", m.Body)
	return nil
}
