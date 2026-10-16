package config_test

import (
	"log/slog"
	"strings"
	"testing"

	"github.com/kapildev333/shopperstop/services/rider/internal/config"
)

const pepper32 = "0123456789abcdef0123456789abcdef"

// env returns a getenv over the given map; unset names read as "".
func env(vars map[string]string) func(string) string {
	return func(name string) string { return vars[name] }
}

func valid() map[string]string {
	return map[string]string{
		"SHOPPERSTOP_RIDER_DATABASE_URL":       "postgres://x",
		"SHOPPERSTOP_RIDER_ADDR":               ":8081",
		"SHOPPERSTOP_RIDER_SESSION_PEPPER":     pepper32,
		"SHOPPERSTOP_RIDER_WEB_ORIGINS":        "http://localhost:15175",
		"SHOPPERSTOP_RIDER_CORE_URL":           "http://localhost:8080",
		"SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN": "dev-rider-service-token",
	}
}

// TestLoadNamesEveryMissingVariable: one error names all six required variables.
func TestLoadNamesEveryMissingVariable(t *testing.T) {
	_, err := config.Load(env(map[string]string{}))
	if err == nil {
		t.Fatal("Load with nothing set: want error, got nil")
	}
	for _, name := range []string{
		"SHOPPERSTOP_RIDER_DATABASE_URL",
		"SHOPPERSTOP_RIDER_ADDR",
		"SHOPPERSTOP_RIDER_SESSION_PEPPER",
		"SHOPPERSTOP_RIDER_WEB_ORIGINS",
		"SHOPPERSTOP_RIDER_CORE_URL",
		"SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN",
	} {
		if !strings.Contains(err.Error(), name) {
			t.Errorf("error does not name %s: %v", name, err)
		}
	}
}

// TestLoadRefusesShortPepperAndBadCoreURL: a 31-byte pepper and a URL without a scheme are both named.
func TestLoadRefusesShortPepperAndBadCoreURL(t *testing.T) {
	vars := valid()
	vars["SHOPPERSTOP_RIDER_SESSION_PEPPER"] = strings.Repeat("x", 31)
	vars["SHOPPERSTOP_RIDER_CORE_URL"] = "localhost:8080"
	_, err := config.Load(env(vars))
	if err == nil {
		t.Fatal("31-byte pepper and bare core URL: want error, got nil")
	}
	if !strings.Contains(err.Error(), "SHOPPERSTOP_RIDER_SESSION_PEPPER") || !strings.Contains(err.Error(), "at least 32 bytes") {
		t.Errorf("error does not say the pepper must be at least 32 bytes: %v", err)
	}
	if !strings.Contains(err.Error(), "SHOPPERSTOP_RIDER_CORE_URL") {
		t.Errorf("error does not name SHOPPERSTOP_RIDER_CORE_URL: %v", err)
	}
}

// TestLoadFullEnvironment: a valid environment loads with trimmed origins, dropped empties,
// the core URL without its trailing slash, the service token as given, and level info.
func TestLoadFullEnvironment(t *testing.T) {
	vars := valid()
	vars["SHOPPERSTOP_RIDER_WEB_ORIGINS"] = " http://a , http://b,"
	vars["SHOPPERSTOP_RIDER_CORE_URL"] = " http://core.internal:8080/ "
	cfg, err := config.Load(env(vars))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got, want := strings.Join(cfg.WebOrigins, " "), "http://a http://b"; got != want {
		t.Errorf("WebOrigins = %q, want %q", got, want)
	}
	if cfg.CoreURL != "http://core.internal:8080" {
		t.Errorf("CoreURL = %q, want the trimmed URL without its trailing slash", cfg.CoreURL)
	}
	if cfg.CoreServiceToken != "dev-rider-service-token" {
		t.Errorf("CoreServiceToken = %q", cfg.CoreServiceToken)
	}
	if cfg.DatabaseURL != "postgres://x" || cfg.Addr != ":8081" || cfg.SessionPepper != pepper32 {
		t.Errorf("database, addr or pepper not loaded: %+v", cfg)
	}
	if cfg.LogLevel != slog.LevelInfo {
		t.Errorf("unset level = %v, want info", cfg.LogLevel)
	}

	vars["SHOPPERSTOP_RIDER_LOG_LEVEL"] = "debug"
	if cfg, err = config.Load(env(vars)); err != nil || cfg.LogLevel != slog.LevelDebug {
		t.Fatalf("debug: level %v err %v", cfg.LogLevel, err)
	}
	vars["SHOPPERSTOP_RIDER_LOG_LEVEL"] = "loud"
	_, err = config.Load(env(vars))
	if err == nil || !strings.Contains(err.Error(), "SHOPPERSTOP_RIDER_LOG_LEVEL") {
		t.Errorf("loud: want error naming SHOPPERSTOP_RIDER_LOG_LEVEL, got %v", err)
	}
}
