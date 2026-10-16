// Package config reads the core service's SHOPPERSTOP_CORE_* environment.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"unicode"
)

const (
	minPepperBytes       = 32
	minServiceTokenBytes = 32
)

// Config is the core service's configuration after Load has checked it.
type Config struct {
	DatabaseURL   string     // SHOPPERSTOP_CORE_DATABASE_URL, required
	Addr          string     // SHOPPERSTOP_CORE_ADDR, required
	SessionPepper string     // SHOPPERSTOP_CORE_SESSION_PEPPER, required, >= 32 bytes
	WebOrigins    []string   // SHOPPERSTOP_CORE_WEB_ORIGINS, required, trimmed, empties dropped
	FilesDir      string     // SHOPPERSTOP_CORE_FILES_DIR, required, trimmed
	LogLevel      slog.Level // SHOPPERSTOP_CORE_LOG_LEVEL, optional, default info
	// ServiceTokens maps a service name to its token, from
	// SHOPPERSTOP_CORE_SERVICE_TOKENS ("name:token,..."), optional; nil when unset.
	ServiceTokens map[string]string
	// TrustProxy is SHOPPERSTOP_CORE_TRUST_PROXY: "true" or "false", optional,
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

	cfg.FilesDir = strings.TrimSpace(getenv("SHOPPERSTOP_CORE_FILES_DIR"))
	if cfg.FilesDir == "" {
		missing("SHOPPERSTOP_CORE_FILES_DIR")
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

	cfg.ServiceTokens, problems = serviceTokens(getenv("SHOPPERSTOP_CORE_SERVICE_TOKENS"), problems)

	switch v := strings.TrimSpace(getenv("SHOPPERSTOP_CORE_TRUST_PROXY")); v {
	case "", "false":
	case "true":
		cfg.TrustProxy = true
	default:
		problems = append(problems, fmt.Errorf("SHOPPERSTOP_CORE_TRUST_PROXY must be true or false (got %q)", v))
	}

	if len(problems) > 0 {
		return Config{}, errors.Join(problems...)
	}
	return cfg, nil
}

// serviceTokens parses "name:token,..." into a map and appends one problem per
// bad entry: no colon, an empty name, whitespace inside the name or the token, a
// token under 32 bytes, a repeated name or a repeated token. The token itself never appears in a problem.
func serviceTokens(v string, problems []error) (map[string]string, []error) {
	const name = "SHOPPERSTOP_CORE_SERVICE_TOKENS"
	var tokens map[string]string
	seen := map[string]bool{}
	for _, entry := range strings.Split(v, ",") {
		if entry = strings.TrimSpace(entry); entry == "" {
			continue
		}
		service, token, ok := strings.Cut(entry, ":")
		switch {
		case !ok || service == "" || strings.ContainsFunc(entry, unicode.IsSpace):
			problems = append(problems, fmt.Errorf("%s entries must be name:token with no spaces", name))
		case len(token) < minServiceTokenBytes:
			problems = append(problems, fmt.Errorf("%s token for %q must be at least %d bytes", name, service, minServiceTokenBytes))
		case tokens[service] != "":
			problems = append(problems, fmt.Errorf("%s names %q twice", name, service))
		case seen[token]:
			problems = append(problems, fmt.Errorf("%s gives %q the token of another service", name, service))
		default:
			if tokens == nil {
				tokens = map[string]string{}
			}
			tokens[service] = token
			seen[token] = true
		}
	}
	return tokens, problems
}
