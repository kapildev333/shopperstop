// Package config reads the rider service's SHOPPERSTOP_RIDER_* environment.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"strings"
)

const minPepperBytes = 32

// Config is the rider service's configuration after Load has checked it.
type Config struct {
	DatabaseURL      string     // SHOPPERSTOP_RIDER_DATABASE_URL, required
	Addr             string     // SHOPPERSTOP_RIDER_ADDR, required
	SessionPepper    string     // SHOPPERSTOP_RIDER_SESSION_PEPPER, required, >= 32 bytes
	WebOrigins       []string   // SHOPPERSTOP_RIDER_WEB_ORIGINS, required, trimmed, empties dropped
	CoreURL          string     // SHOPPERSTOP_RIDER_CORE_URL, required, http or https, trailing slash dropped
	CoreServiceToken string     // SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN, required
	LogLevel         slog.Level // SHOPPERSTOP_RIDER_LOG_LEVEL, optional, default info
	// TrustProxy is SHOPPERSTOP_RIDER_TRUST_PROXY: "true" or "false", optional,
	// default false. True makes the rate limiter key on X-Forwarded-For.
	TrustProxy bool
}

// Load reads the configuration through getenv and reports every problem
// at once, so one failed start names everything that is wrong.
func Load(getenv func(string) string) (Config, error) {
	var cfg Config
	var problems []error
	missing := func(name string) {
		problems = append(problems, fmt.Errorf("%s is required", name))
	}

	cfg.DatabaseURL = strings.TrimSpace(getenv("SHOPPERSTOP_RIDER_DATABASE_URL"))
	if cfg.DatabaseURL == "" {
		missing("SHOPPERSTOP_RIDER_DATABASE_URL")
	}

	cfg.Addr = strings.TrimSpace(getenv("SHOPPERSTOP_RIDER_ADDR"))
	if cfg.Addr == "" {
		missing("SHOPPERSTOP_RIDER_ADDR")
	}

	cfg.SessionPepper = getenv("SHOPPERSTOP_RIDER_SESSION_PEPPER")
	switch {
	case strings.TrimSpace(cfg.SessionPepper) == "":
		missing("SHOPPERSTOP_RIDER_SESSION_PEPPER")
	case len(cfg.SessionPepper) < minPepperBytes:
		problems = append(problems, fmt.Errorf("SHOPPERSTOP_RIDER_SESSION_PEPPER must be at least %d bytes", minPepperBytes))
	}

	for _, origin := range strings.Split(getenv("SHOPPERSTOP_RIDER_WEB_ORIGINS"), ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			cfg.WebOrigins = append(cfg.WebOrigins, origin)
		}
	}
	if len(cfg.WebOrigins) == 0 {
		missing("SHOPPERSTOP_RIDER_WEB_ORIGINS")
	}

	cfg.CoreURL = strings.TrimRight(strings.TrimSpace(getenv("SHOPPERSTOP_RIDER_CORE_URL")), "/")
	if cfg.CoreURL == "" {
		missing("SHOPPERSTOP_RIDER_CORE_URL")
	} else if u, err := url.Parse(cfg.CoreURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		problems = append(problems, fmt.Errorf("SHOPPERSTOP_RIDER_CORE_URL must be an absolute http or https URL (got %q)", cfg.CoreURL))
	}

	cfg.CoreServiceToken = getenv("SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN")
	if strings.TrimSpace(cfg.CoreServiceToken) == "" {
		missing("SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN")
	}

	cfg.LogLevel = slog.LevelInfo
	if level := strings.TrimSpace(getenv("SHOPPERSTOP_RIDER_LOG_LEVEL")); level != "" {
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
			problems = append(problems, fmt.Errorf("SHOPPERSTOP_RIDER_LOG_LEVEL must be one of debug, info, warn, error (got %q)", level))
		}
	}

	switch v := strings.TrimSpace(getenv("SHOPPERSTOP_RIDER_TRUST_PROXY")); v {
	case "", "false":
	case "true":
		cfg.TrustProxy = true
	default:
		problems = append(problems, fmt.Errorf("SHOPPERSTOP_RIDER_TRUST_PROXY must be true or false (got %q)", v))
	}

	if len(problems) > 0 {
		return Config{}, errors.Join(problems...)
	}
	return cfg, nil
}
