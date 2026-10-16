package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"
)

func TestLogMailerLogsTheMessage(t *testing.T) {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })

	m := Mail{To: "asha@example.com", Subject: "Verify your ShopperStop email", Body: "Use this code: abc"}
	if err := (LogMailer{}).Send(context.Background(), m); err != nil {
		t.Fatal(err)
	}
	var line struct{ Msg, To, Subject, Body string }
	if err := json.Unmarshal(buf.Bytes(), &line); err != nil || line.Msg != "mail" || line.To != m.To || line.Subject != m.Subject || line.Body != m.Body {
		t.Fatalf("log line %s: want msg mail with to, subject and body", buf.Bytes())
	}
}
