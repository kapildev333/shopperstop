// Package config reads the core service's SHOPPERSTOP_CORE_* environment.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"
)

const minPepperBytes = 32

// Config is the core service's configuration after Load has checked it.
type Config struct {
	DatabaseURL   string     // SHOPPERSTOP_CORE_DATABASE_URL, required
	Addr          string     // SHOPPERSTOP_CORE_ADDR, required
	SessionPepper string     // SHOPPERSTOP_CORE_SESSION_PEPPER, required, >= 32 bytes
	WebOrigins    []string   // SHOPPERSTOP_CORE_WEB_ORIGINS, required, trimmed, empties dropped
	LogLevel      slog.Level // SHOPPERSTOP_CORE_LOG_LEVEL, optional, default info
}

// Load reads the configuration through getenv and reports every problem
// at once, so one failed start names everything that is wrong.
func Load(getenv func(string) string) (Config, error) {
	var cfg Config
	var problems []error
	missing := func(name string) {
		problems = append(problems, fmt.Errorf("%s is required", name))
	}

	cfg.DatabaseURL = strings.TrimSpace(getenv("SHOPPERSTOP_CORE_DATABASE_URL"))
	if cfg.DatabaseURL == "" {
		missing("SHOPPERSTOP_CORE_DATABASE_URL")
	}

	cfg.Addr = strings.TrimSpace(getenv("SHOPPERSTOP_CORE_ADDR"))
	if cfg.Addr == "" {
		missing("SHOPPERSTOP_CORE_ADDR")
	}

	cfg.SessionPepper = getenv("SHOPPERSTOP_CORE_SESSION_PEPPER")
	switch {
	case strings.TrimSpace(cfg.SessionPepper) == "":
		missing("SHOPPERSTOP_CORE_SESSION_PEPPER")
	case len(cfg.SessionPepper) < minPepperBytes:
		problems = append(problems, fmt.Errorf("SHOPPERSTOP_CORE_SESSION_PEPPER must be at least %d bytes", minPepperBytes))
	}

	for _, origin := range strings.Split(getenv("SHOPPERSTOP_CORE_WEB_ORIGINS"), ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			cfg.WebOrigins = append(cfg.WebOrigins, origin)
		}
	}
	if len(cfg.WebOrigins) == 0 {
		missing("SHOPPERSTOP_CORE_WEB_ORIGINS")
	}

	cfg.LogLevel = slog.LevelInfo
	if level := strings.TrimSpace(getenv("SHOPPERSTOP_CORE_LOG_LEVEL")); level != "" {
		switch level {
		case "debug":
			cfg.LogLevel = slog.LevelDebug
		case "info":
			cfg.LogLevel = slog.LevelInfo
		case "warn":
			cfg.LogLevel = slog.LevelWarn
		case "error":
			cfg.LogLevel = slog.LevelError
		default:
			problems = append(problems, fmt.Errorf("SHOPPERSTOP_CORE_LOG_LEVEL must be one of debug, info, warn, error (got %q)", level))
		}
	}

	if len(problems) > 0 {
		return Config{}, errors.Join(problems...)
	}
	return cfg, nil
}
