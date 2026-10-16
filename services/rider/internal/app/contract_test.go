package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

// responseSpec is the part of an OpenAPI response the contract checks.
type responseSpec struct {
	Content map[string]struct {
		Example  json.RawMessage            `json:"example"`
		Examples map[string]json.RawMessage `json:"examples"`
	} `json:"content"`
}

// contractProblems compares the served routes with the documented operations
// and returns one line per mismatch. Documented paths are joined with
// servers[0].url; each line names "METHOD <server url><path>". Every
// operation needs a summary, a description, a tag, and an example on every
// response that declares content (and at least one example overall).
func contractProblems(routes chi.Routes, doc []byte) []string {
	served := map[string]bool{}
	_ = chi.Walk(routes, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		served[method+" "+route] = true
		return nil
	})

	var spec struct {
		Servers []struct {
			URL string `json:"url"`
		} `json:"servers"`
		Paths map[string]map[string]json.RawMessage `json:"paths"`
	}
	if err := json.Unmarshal(doc, &spec); err != nil {
		return []string{fmt.Sprintf("openapi.json does not parse: %v", err)}
	}
	if len(spec.Servers) == 0 {
		return []string{"openapi.json lists no servers"}
	}
	base := spec.Servers[0].URL

	var problems []string
	documented := map[string]bool{}
	for path, item := range spec.Paths {
		for method, raw := range item {
			switch strings.ToLower(method) {
			case "get", "post", "put", "patch", "delete":
			default:
				continue // path-level keys such as summary or parameters
			}
			key := strings.ToUpper(method) + " " + base + path
			documented[key] = true
			var op struct {
				Summary     string                  `json:"summary"`
				Description string                  `json:"description"`
				Tags        []string                `json:"tags"`
				Responses   map[string]responseSpec `json:"responses"`
			}
			if err := json.Unmarshal(raw, &op); err != nil {
				problems = append(problems, fmt.Sprintf("%s: operation does not parse: %v", key, err))
				continue
			}
			if op.Summary == "" {
				problems = append(problems, key+": missing summary")
			}
			if op.Description == "" {
				problems = append(problems, key+": missing description")
			}
			if len(op.Tags) == 0 {
				problems = append(problems, key+": missing tag")
			}
			if !anyExample(op.Responses) {
				problems = append(problems, key+": missing response example")
			}
			for _, code := range withoutExample(op.Responses) {
				problems = append(problems, fmt.Sprintf("%s: response %s missing example", key, code))
			}
		}
	}
	for key := range served {
		if !documented[key] {
			problems = append(problems, key+": served but not in openapi.json")
		}
	}
	for key := range documented {
		if !served[key] {
			problems = append(problems, key+": documented but not served")
		}
	}
	sort.Strings(problems)
	return problems
}

// hasExampleIn reports whether a response's content carries an example.
func hasExampleIn(resp responseSpec) bool {
	for _, media := range resp.Content {
		if len(media.Example) > 0 || len(media.Examples) > 0 {
			return true
		}
	}
	return false
}

// anyExample reports whether any response carries an example.
func anyExample(responses map[string]responseSpec) bool {
	for _, resp := range responses {
		if hasExampleIn(resp) {
			return true
		}
	}
	return false
}

// withoutExample returns the codes of responses that declare content but no example.
func withoutExample(responses map[string]responseSpec) []string {
	var codes []string
	for code, resp := range responses {
		if len(resp.Content) > 0 && !hasExampleIn(resp) {
			codes = append(codes, code)
		}
	}
	sort.Strings(codes)
	return codes
}

// TestContract checks the real router against the real openapi.json.
func TestContract(t *testing.T) {
	doc, err := os.ReadFile("../../openapi.json")
	if err != nil {
		t.Fatal(err)
	}
	if problems := contractProblems(New(nil, nil, nil), doc); len(problems) > 0 {
		t.Fatalf("contract problems:\n%s", strings.Join(problems, "\n"))
	}
}

// toyDoc is one documented operation with summary, description, tag and example.
const toyDoc = `{"openapi":"3.1.0","servers":[{"url":"/api/rider/v1"}],"paths":{"/extra":{"get":{
  "summary":"s","description":"d","tags":["platform"],
  "responses":{"200":{"description":"ok","content":{"application/json":{"example":{"ok":true}}}}}}}}}`

const toyDocNoExample = `{"openapi":"3.1.0","servers":[{"url":"/api/rider/v1"}],"paths":{"/extra":{"get":{
  "summary":"s","description":"d","tags":["platform"],
  "responses":{"200":{"description":"ok"}}}}}}`

// toyDocMissing503Example documents a 200 example but no example on the 503.
const toyDocMissing503Example = `{"openapi":"3.1.0","servers":[{"url":"/api/rider/v1"}],"paths":{"/extra":{"get":{
  "summary":"s","description":"d","tags":["platform"],
  "responses":{
    "200":{"description":"ok","content":{"application/json":{"example":{"ok":true}}}},
    "503":{"description":"down","content":{"application/json":{"schema":{"type":"object"}}}}}}}}}`

func toyRouter() chi.Router {
	r := chi.NewRouter()
	r.Get("/api/rider/v1/extra", http.NotFound)
	return r
}

func TestContractNamesUndocumentedRoute(t *testing.T) {
	problems := contractProblems(toyRouter(), []byte(`{"openapi":"3.1.0","servers":[{"url":"/api/rider/v1"}],"paths":{}}`))
	if !containsProblem(problems, "GET /api/rider/v1/extra") {
		t.Fatalf("want a problem naming GET /api/rider/v1/extra, got %q", problems)
	}
}

func TestContractNamesUnservedPath(t *testing.T) {
	problems := contractProblems(chi.NewRouter(), []byte(toyDoc))
	if !containsProblem(problems, "GET /api/rider/v1/extra") {
		t.Fatalf("want a problem naming GET /api/rider/v1/extra, got %q", problems)
	}
}

func TestContractNamesMissingExample(t *testing.T) {
	problems := contractProblems(toyRouter(), []byte(toyDocNoExample))
	if !containsProblem(problems, "GET /api/rider/v1/extra") {
		t.Fatalf("want a problem naming GET /api/rider/v1/extra, got %q", problems)
	}
}

// TestContractUsesServersURL joins paths with servers[0].url, not a fixed prefix.
func TestContractUsesServersURL(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/api/other/v1/extra", http.NotFound)
	doc := `{"openapi":"3.1.0","servers":[{"url":"/api/other/v1"}],"paths":{"/extra":{"get":{
  "summary":"s","description":"d","tags":["platform"],
  "responses":{"200":{"description":"ok","content":{"application/json":{"example":{"ok":true}}}}}}}}}`
	if problems := contractProblems(r, []byte(doc)); len(problems) > 0 {
		t.Fatalf("want no problems with servers /api/other/v1, got %q", problems)
	}
}

// TestContractNamesMissing503Example: every response that declares content needs an example.
func TestContractNamesMissing503Example(t *testing.T) {
	problems := contractProblems(toyRouter(), []byte(toyDocMissing503Example))
	if !containsProblem(problems, "GET /api/rider/v1/extra") || !containsProblem(problems, "503") {
		t.Fatalf("want a problem naming GET /api/rider/v1/extra and response 503, got %q", problems)
	}
}

func containsProblem(problems []string, name string) bool {
	for _, p := range problems {
		if strings.Contains(p, name) {
			return true
		}
	}
	return false
}

// zeroID fills every {param} of a documented path for the anonymous probe.
const zeroID = "00000000-0000-4000-8000-000000000000"

var pathParam = regexp.MustCompile(`\{[^}]+\}`)

// securityProblems sends one anonymous request to every documented operation
// and checks the operation's security declaration against the router's answer:
// a 401 must match declared security, and declared security must document a 401.
func securityProblems(baseURL string, doc []byte) []string {
	var spec struct {
		Servers []struct {
			URL string `json:"url"`
		} `json:"servers"`
		Components struct {
			SecuritySchemes map[string]struct {
				Type   string `json:"type"`
				Scheme string `json:"scheme"`
			} `json:"securitySchemes"`
		} `json:"components"`
		Paths map[string]map[string]json.RawMessage `json:"paths"`
	}
	if err := json.Unmarshal(doc, &spec); err != nil {
		return []string{fmt.Sprintf("openapi.json does not parse: %v", err)}
	}
	if len(spec.Servers) == 0 {
		return []string{"openapi.json lists no servers"}
	}
	base := spec.Servers[0].URL
	var problems []string
	bearer := spec.Components.SecuritySchemes["bearer"]
	if bearer.Type != "http" || bearer.Scheme != "bearer" {
		problems = append(problems, `components.securitySchemes.bearer must be {"type":"http","scheme":"bearer"}`)
	}
	for path, item := range spec.Paths {
		for method, raw := range item {
			switch strings.ToLower(method) {
			case "get", "post", "put", "patch", "delete":
			default:
				continue
			}
			key := strings.ToUpper(method) + " " + base + path
			var op struct {
				Security  []map[string][]string      `json:"security"`
				Responses map[string]json.RawMessage `json:"responses"`
			}
			if err := json.Unmarshal(raw, &op); err != nil {
				problems = append(problems, key+": operation does not parse: "+err.Error())
				continue
			}
			declared := len(op.Security) > 0
			if declared {
				if len(op.Security) != 1 || len(op.Security[0]) != 1 || op.Security[0]["bearer"] == nil {
					problems = append(problems, key+`: security must be [{"bearer":[]}]`)
				}
				if _, ok := op.Responses["401"]; !ok {
					problems = append(problems, key+": declares security but documents no 401")
				}
			}
			req, err := http.NewRequest(strings.ToUpper(method), baseURL+base+pathParam.ReplaceAllString(path, zeroID), nil)
			if err != nil {
				problems = append(problems, key+": bad request: "+err.Error())
				continue
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				problems = append(problems, key+": request failed: "+err.Error())
				continue
			}
			resp.Body.Close()
			switch {
			case declared && resp.StatusCode != http.StatusUnauthorized:
				problems = append(problems, fmt.Sprintf("%s: declares security but answers %d without a token", key, resp.StatusCode))
			case !declared && resp.StatusCode == http.StatusUnauthorized:
				problems = append(problems, key+": answers 401 without a token but declares no security")
			}
		}
	}
	sort.Strings(problems)
	return problems
}

// TestContractSecurity checks the real router against the real openapi.json security.
func TestContractSecurity(t *testing.T) {
	doc, err := os.ReadFile("../../openapi.json")
	if err != nil {
		t.Fatal(err)
	}
	if problems := securityProblems(srv.URL, doc); len(problems) > 0 {
		t.Fatalf("security problems:\n%s", strings.Join(problems, "\n"))
	}
}

// toySecurityDoc documents GET /api/rider/v1/extra with a 401, with or without security.
func toySecurityDoc(secured bool) string {
	security := ""
	if secured {
		security = `"security":[{"bearer":[]}],`
	}
	return `{"openapi":"3.1.0","servers":[{"url":"/api/rider/v1"}],
  "components":{"securitySchemes":{"bearer":{"type":"http","scheme":"bearer"}}},
  "paths":{"/extra":{"get":{"summary":"s","description":"d","tags":["accounts"],` + security + `
  "responses":{"200":{"description":"ok"},"401":{"description":"no token"}}}}}}`
}

// toySecurityProblems serves a toy router that answers status to GET /extra
// and returns securityProblems for doc against it.
func toySecurityProblems(t *testing.T, status int, doc string) []string {
	t.Helper()
	r := chi.NewRouter()
	r.Get("/api/rider/v1/extra", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(status) })
	ts := httptest.NewServer(r)
	t.Cleanup(ts.Close)
	return securityProblems(ts.URL, []byte(doc))
}

// TestContractNamesMissingSecurity: a route that answers 401 must declare security.
func TestContractNamesMissingSecurity(t *testing.T) {
	problems := toySecurityProblems(t, http.StatusUnauthorized, toySecurityDoc(false))
	if !containsProblem(problems, "GET /api/rider/v1/extra") {
		t.Fatalf("want a problem naming GET /api/rider/v1/extra, got %q", problems)
	}
}

// TestContractNamesNeedlessSecurity: an operation that answers without a token must not declare security.
func TestContractNamesNeedlessSecurity(t *testing.T) {
	problems := toySecurityProblems(t, http.StatusOK, toySecurityDoc(true))
	if !containsProblem(problems, "GET /api/rider/v1/extra") || !containsProblem(problems, "answers 200") {
		t.Fatalf("want a problem naming GET /api/rider/v1/extra and answers 200, got %q", problems)
	}
}

// TestContractNamesSecurityWithout401: declared security must document its 401.
func TestContractNamesSecurityWithout401(t *testing.T) {
	doc := strings.Replace(toySecurityDoc(true), `,"401":{"description":"no token"}`, "", 1)
	problems := toySecurityProblems(t, http.StatusUnauthorized, doc)
	if !containsProblem(problems, "documents no 401") {
		t.Fatalf("want a problem saying the 401 is undocumented, got %q", problems)
	}
}
