// Package config reads the rider service's SHOPPERSTOP_RIDER_* environment.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net/url"
	"strconv"
	"strings"
	"time"
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

	// The dispatcher (rider-dispatch), each optional with a default:
	DispatchInterval    time.Duration // SHOPPERSTOP_RIDER_DISPATCH_INTERVAL, default 3s, 0 turns the dispatcher off
	DispatchOfferTTL    time.Duration // SHOPPERSTOP_RIDER_DISPATCH_OFFER_TTL, default 30s, > 0
	DispatchLocationTTL time.Duration // SHOPPERSTOP_RIDER_DISPATCH_LOCATION_TTL, default 2m, > 0
	DispatchSpeedKMH    float64       // SHOPPERSTOP_RIDER_DISPATCH_SPEED_KMH, default 20, > 0
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

	duration := func(name string, def time.Duration, zeroOK bool) time.Duration {
		v := strings.TrimSpace(getenv(name))
		if v == "" {
			return def
		}
		d, err := time.ParseDuration(v)
		if err != nil || d < 0 || (d == 0 && !zeroOK) {
			least := "above zero"
			if zeroOK {
				least = "zero or above"
			}
			problems = append(problems, fmt.Errorf("%s must be a Go duration such as 30s, %s (got %q)", name, least, v))
		}
		return d
	}
	cfg.DispatchInterval = duration("SHOPPERSTOP_RIDER_DISPATCH_INTERVAL", 3*time.Second, true)
	cfg.DispatchOfferTTL = duration("SHOPPERSTOP_RIDER_DISPATCH_OFFER_TTL", 30*time.Second, false)
	cfg.DispatchLocationTTL = duration("SHOPPERSTOP_RIDER_DISPATCH_LOCATION_TTL", 2*time.Minute, false)
	cfg.DispatchSpeedKMH = 20
	if v := strings.TrimSpace(getenv("SHOPPERSTOP_RIDER_DISPATCH_SPEED_KMH")); v != "" {
		speed, err := strconv.ParseFloat(v, 64)
		if err != nil || !(speed > 0) || math.IsInf(speed, 0) {
			problems = append(problems, fmt.Errorf("SHOPPERSTOP_RIDER_DISPATCH_SPEED_KMH must be a positive number (got %q)", v))
		}
		cfg.DispatchSpeedKMH = speed
	}

	if len(problems) > 0 {
		return Config{}, errors.Join(problems...)
	}
	return cfg, nil
}
