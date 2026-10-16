package config_test

import (
	"log/slog"
	"strings"
	"testing"

	"github.com/kapildev333/shopperstop/services/core/internal/config"
)

const pepper32 = "0123456789abcdef0123456789abcdef"

// env returns a getenv over the given map; unset names read as "".
func env(vars map[string]string) func(string) string {
	return func(name string) string { return vars[name] }
}

func valid() map[string]string {
	return map[string]string{
		"SHOPPERSTOP_CORE_DATABASE_URL":   "postgres://x",
		"SHOPPERSTOP_CORE_ADDR":           ":8080",
		"SHOPPERSTOP_CORE_SESSION_PEPPER": pepper32,
		"SHOPPERSTOP_CORE_WEB_ORIGINS":    "http://localhost:5173",
		"SHOPPERSTOP_CORE_FILES_DIR":      "/var/lib/shopperstop/files",
	}
}

func TestLoadNamesEveryMissingVariable(t *testing.T) {
	_, err := config.Load(env(map[string]string{}))
	if err == nil {
		t.Fatal("Load with nothing set: want error, got nil")
	}
	for _, name := range []string{
		"SHOPPERSTOP_CORE_DATABASE_URL",
		"SHOPPERSTOP_CORE_ADDR",
		"SHOPPERSTOP_CORE_SESSION_PEPPER",
		"SHOPPERSTOP_CORE_WEB_ORIGINS",
		"SHOPPERSTOP_CORE_FILES_DIR",
	} {
		if !strings.Contains(err.Error(), name) {
			t.Errorf("error does not name %s: %v", name, err)
		}
	}
}

func TestLoadFilesDir(t *testing.T) {
	vars := valid()
	vars["SHOPPERSTOP_CORE_FILES_DIR"] = "  /srv/files  "
	cfg, err := config.Load(env(vars))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.FilesDir != "/srv/files" {
		t.Errorf("FilesDir = %q, want %q", cfg.FilesDir, "/srv/files")
	}

	vars["SHOPPERSTOP_CORE_FILES_DIR"] = "   "
	_, err = config.Load(env(vars))
	if err == nil || !strings.Contains(err.Error(), "SHOPPERSTOP_CORE_FILES_DIR is required") {
		t.Errorf("blank files dir: want error naming SHOPPERSTOP_CORE_FILES_DIR as required, got %v", err)
	}
}

func TestLoadRefusesShortPepper(t *testing.T) {
	vars := valid()
	vars["SHOPPERSTOP_CORE_SESSION_PEPPER"] = strings.Repeat("x", 31)
	_, err := config.Load(env(vars))
	if err == nil {
		t.Fatal("31-byte pepper: want error, got nil")
	}
	if !strings.Contains(err.Error(), "SHOPPERSTOP_CORE_SESSION_PEPPER") || !strings.Contains(err.Error(), "at least 32 bytes") {
		t.Errorf("error does not say the pepper must be at least 32 bytes: %v", err)
	}
}

func TestLoadTrimsOrigins(t *testing.T) {
	vars := valid()
	vars["SHOPPERSTOP_CORE_WEB_ORIGINS"] = "http://a, http://b,"
	cfg, err := config.Load(env(vars))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got, want := strings.Join(cfg.WebOrigins, " "), "http://a http://b"; got != want {
		t.Errorf("WebOrigins = %q, want %q", got, want)
	}

	vars["SHOPPERSTOP_CORE_WEB_ORIGINS"] = ","
	_, err = config.Load(env(vars))
	if err == nil || !strings.Contains(err.Error(), "SHOPPERSTOP_CORE_WEB_ORIGINS") {
		t.Errorf("only commas: want error naming SHOPPERSTOP_CORE_WEB_ORIGINS, got %v", err)
	}
}

func TestLoadLogLevel(t *testing.T) {
	cfg, err := config.Load(env(valid()))
	if err != nil {
		t.Fatalf("unset level: Load: %v", err)
	}
	if cfg.LogLevel != slog.LevelInfo {
		t.Errorf("unset level = %v, want info", cfg.LogLevel)
	}

	vars := valid()
	vars["SHOPPERSTOP_CORE_LOG_LEVEL"] = "debug"
	cfg, err = config.Load(env(vars))
	if err != nil {
		t.Fatalf("debug: Load: %v", err)
	}
	if cfg.LogLevel != slog.LevelDebug {
		t.Errorf("debug level = %v, want debug", cfg.LogLevel)
	}

	vars["SHOPPERSTOP_CORE_LOG_LEVEL"] = "loud"
	_, err = config.Load(env(vars))
	if err == nil || !strings.Contains(err.Error(), "SHOPPERSTOP_CORE_LOG_LEVEL") {
		t.Errorf("loud: want error naming SHOPPERSTOP_CORE_LOG_LEVEL, got %v", err)
	}
}

// TestLoadTrustProxy: unset, empty and "false" load false, "true" loads true
// (surrounding spaces ignored), anything else refuses naming the variable.
func TestLoadTrustProxy(t *testing.T) {
	for value, want := range map[string]bool{"": false, "false": false, " true ": true, "true": true} {
		vars := valid()
		vars["SHOPPERSTOP_CORE_TRUST_PROXY"] = value
		cfg, err := config.Load(env(vars))
		if err != nil || cfg.TrustProxy != want {
			t.Fatalf("Load with %q: TrustProxy %v, err %v; want %v and no error", value, cfg.TrustProxy, err, want)
		}
	}
	for _, value := range []string{"yes", "1", "TRUE"} {
		vars := valid()
		vars["SHOPPERSTOP_CORE_TRUST_PROXY"] = value
		_, err := config.Load(env(vars))
		if err == nil || !strings.Contains(err.Error(), "SHOPPERSTOP_CORE_TRUST_PROXY must be true or false") {
			t.Fatalf("Load with %q: %v, want an error naming SHOPPERSTOP_CORE_TRUST_PROXY", value, err)
		}
	}
}

// TestLoadServiceTokens: the Makefile's dev and e2e values load as service rider;
// unset, empty or only separators load none.
func TestLoadServiceTokens(t *testing.T) {
	for _, token := range []string{"dev-rider-service-token-dev-rider-00", "e2e-rider-service-token-e2e-rider-00"} {
		vars := valid()
		vars["SHOPPERSTOP_CORE_SERVICE_TOKENS"] = "rider:" + token
		cfg, err := config.Load(env(vars))
		if err != nil {
			t.Fatalf("Load with rider:%s: %v", token, err)
		}
		if len(cfg.ServiceTokens) != 1 || cfg.ServiceTokens["rider"] != token {
			t.Fatalf("ServiceTokens %v, want only rider:%s", cfg.ServiceTokens, token)
		}
	}
	for _, v := range []string{"", " , "} {
		vars := valid()
		vars["SHOPPERSTOP_CORE_SERVICE_TOKENS"] = v
		cfg, err := config.Load(env(vars))
		if err != nil || len(cfg.ServiceTokens) != 0 {
			t.Fatalf("Load with %q: %v %v, want no tokens and no error", v, cfg.ServiceTokens, err)
		}
	}
	cfg, err := config.Load(env(valid()))
	if err != nil || cfg.ServiceTokens != nil {
		t.Fatalf("Load unset: %v %v, want nil tokens and no error", cfg.ServiceTokens, err)
	}
}

// TestLoadRefusesBadServiceTokens: each bad value fails naming the variable and
// the rule, and the error never contains the token.
func TestLoadRefusesBadServiceTokens(t *testing.T) {
	const tok = "0123456789abcdef0123456789abcdef"
	for _, row := range []struct{ value, secret, want string }{
		{"rider:abc123", "abc123", "at least 32 bytes"},
		{"rider" + tok, tok, "name:token"},
		{":" + tok, tok, "name:token"},
		{"rider:" + tok + ",rider:" + tok + "x", tok, "twice"},
		{"rider:" + tok + ",payment:" + tok, tok, "another service"},
		{"rider :" + tok, tok, "name:token"},
		{"rider: " + tok, tok, "name:token"},
		{"rider:" + tok[:16] + " " + tok[16:], tok[:16], "name:token"},
	} {
		vars := valid()
		vars["SHOPPERSTOP_CORE_SERVICE_TOKENS"] = row.value
		_, err := config.Load(env(vars))
		if err == nil || !strings.Contains(err.Error(), "SHOPPERSTOP_CORE_SERVICE_TOKENS") ||
			!strings.Contains(err.Error(), row.want) || strings.Contains(err.Error(), row.secret) {
			t.Fatalf("Load with %q: %v, want an error naming the variable and %q, without the token", row.value, err, row.want)
		}
	}
}
