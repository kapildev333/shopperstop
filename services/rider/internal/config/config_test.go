package config_test

import (
	"log/slog"
	"strings"
	"testing"
	"time"

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

// TestLoadTrustProxy: unset, empty and "false" load false, "true" loads true
// (surrounding spaces ignored), anything else refuses naming the variable.
func TestLoadTrustProxy(t *testing.T) {
	for value, want := range map[string]bool{"": false, "false": false, " true ": true, "true": true} {
		vars := valid()
		vars["SHOPPERSTOP_RIDER_TRUST_PROXY"] = value
		cfg, err := config.Load(env(vars))
		if err != nil || cfg.TrustProxy != want {
			t.Fatalf("Load with %q: TrustProxy %v, err %v; want %v and no error", value, cfg.TrustProxy, err, want)
		}
	}
	for _, value := range []string{"yes", "1", "TRUE"} {
		vars := valid()
		vars["SHOPPERSTOP_RIDER_TRUST_PROXY"] = value
		_, err := config.Load(env(vars))
		if err == nil || !strings.Contains(err.Error(), "SHOPPERSTOP_RIDER_TRUST_PROXY must be true or false") {
			t.Fatalf("Load with %q: %v, want an error naming SHOPPERSTOP_RIDER_TRUST_PROXY", value, err)
		}
	}
}

// TestDispatchDefaults: none of the four dispatch variables set gives D57's defaults.
func TestDispatchDefaults(t *testing.T) {
	cfg, err := config.Load(env(valid()))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DispatchInterval != 3*time.Second || cfg.DispatchOfferTTL != 30*time.Second ||
		cfg.DispatchLocationTTL != 2*time.Minute || cfg.DispatchSpeedKMH != 20 {
		t.Fatalf("dispatch defaults %v %v %v %v, want 3s 30s 2m0s 20", cfg.DispatchInterval, cfg.DispatchOfferTTL, cfg.DispatchLocationTTL, cfg.DispatchSpeedKMH)
	}
}

// TestDispatchOff: an interval of 0 loads and turns the dispatcher off.
func TestDispatchOff(t *testing.T) {
	vars := valid()
	vars["SHOPPERSTOP_RIDER_DISPATCH_INTERVAL"] = "0"
	cfg, err := config.Load(env(vars))
	if err != nil || cfg.DispatchInterval != 0 {
		t.Fatalf("interval 0: got %v, %v; want 0 and no error", cfg.DispatchInterval, err)
	}
}

// TestDispatchBadValuesNamed: each bad dispatch value is named in the one error.
func TestDispatchBadValuesNamed(t *testing.T) {
	vars := valid()
	vars["SHOPPERSTOP_RIDER_DISPATCH_INTERVAL"] = "3"
	vars["SHOPPERSTOP_RIDER_DISPATCH_OFFER_TTL"] = "-1s"
	vars["SHOPPERSTOP_RIDER_DISPATCH_LOCATION_TTL"] = "0"
	vars["SHOPPERSTOP_RIDER_DISPATCH_SPEED_KMH"] = "fast"
	_, err := config.Load(env(vars))
	if err == nil {
		t.Fatal("bad dispatch values: want error, got nil")
	}
	for _, name := range []string{
		"SHOPPERSTOP_RIDER_DISPATCH_INTERVAL",
		"SHOPPERSTOP_RIDER_DISPATCH_OFFER_TTL",
		"SHOPPERSTOP_RIDER_DISPATCH_LOCATION_TTL",
		"SHOPPERSTOP_RIDER_DISPATCH_SPEED_KMH",
	} {
		if !strings.Contains(err.Error(), name) {
			t.Errorf("error does not name %s: %v", name, err)
		}
	}
}
