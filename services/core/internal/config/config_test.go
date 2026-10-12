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
	} {
		if !strings.Contains(err.Error(), name) {
			t.Errorf("error does not name %s: %v", name, err)
		}
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
