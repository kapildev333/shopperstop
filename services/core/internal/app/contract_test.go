package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
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
	if problems := contractProblems(New(nil, nil), doc); len(problems) > 0 {
		t.Fatalf("contract problems:\n%s", strings.Join(problems, "\n"))
	}
}

// toyDoc is one documented operation with summary, description, tag and example.
const toyDoc = `{"openapi":"3.1.0","servers":[{"url":"/api/core/v1"}],"paths":{"/extra":{"get":{
  "summary":"s","description":"d","tags":["platform"],
  "responses":{"200":{"description":"ok","content":{"application/json":{"example":{"ok":true}}}}}}}}}`

const toyDocNoExample = `{"openapi":"3.1.0","servers":[{"url":"/api/core/v1"}],"paths":{"/extra":{"get":{
  "summary":"s","description":"d","tags":["platform"],
  "responses":{"200":{"description":"ok"}}}}}}`

// toyDocMissing503Example documents a 200 example but no example on the 503.
const toyDocMissing503Example = `{"openapi":"3.1.0","servers":[{"url":"/api/core/v1"}],"paths":{"/extra":{"get":{
  "summary":"s","description":"d","tags":["platform"],
  "responses":{
    "200":{"description":"ok","content":{"application/json":{"example":{"ok":true}}}},
    "503":{"description":"down","content":{"application/json":{"schema":{"type":"object"}}}}}}}}}`

func toyRouter() chi.Router {
	r := chi.NewRouter()
	r.Get("/api/core/v1/extra", http.NotFound)
	return r
}

func TestContractNamesUndocumentedRoute(t *testing.T) {
	problems := contractProblems(toyRouter(), []byte(`{"openapi":"3.1.0","servers":[{"url":"/api/core/v1"}],"paths":{}}`))
	if !containsProblem(problems, "GET /api/core/v1/extra") {
		t.Fatalf("want a problem naming GET /api/core/v1/extra, got %q", problems)
	}
}

func TestContractNamesUnservedPath(t *testing.T) {
	problems := contractProblems(chi.NewRouter(), []byte(toyDoc))
	if !containsProblem(problems, "GET /api/core/v1/extra") {
		t.Fatalf("want a problem naming GET /api/core/v1/extra, got %q", problems)
	}
}

func TestContractNamesMissingExample(t *testing.T) {
	problems := contractProblems(toyRouter(), []byte(toyDocNoExample))
	if !containsProblem(problems, "GET /api/core/v1/extra") {
		t.Fatalf("want a problem naming GET /api/core/v1/extra, got %q", problems)
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
	if !containsProblem(problems, "GET /api/core/v1/extra") || !containsProblem(problems, "503") {
		t.Fatalf("want a problem naming GET /api/core/v1/extra and response 503, got %q", problems)
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
