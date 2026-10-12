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

const apiPrefix = "/api/core/v1"

// responseSpec is the part of an OpenAPI response the contract checks.
type responseSpec struct {
	Content map[string]struct {
		Example  json.RawMessage            `json:"example"`
		Examples map[string]json.RawMessage `json:"examples"`
	} `json:"content"`
}

// contractProblems compares the served routes with the documented operations
// and returns one line per mismatch, each naming "METHOD /api/core/v1/path".
// Every documented operation needs a summary, a description, a tag and at
// least one response example.
func contractProblems(routes chi.Routes, doc []byte) []string {
	served := map[string]bool{}
	_ = chi.Walk(routes, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		served[method+" "+route] = true
		return nil
	})

	var spec struct {
		Paths map[string]map[string]json.RawMessage `json:"paths"`
	}
	if err := json.Unmarshal(doc, &spec); err != nil {
		return []string{fmt.Sprintf("openapi.json does not parse: %v", err)}
	}

	var problems []string
	documented := map[string]bool{}
	for path, item := range spec.Paths {
		for method, raw := range item {
			switch strings.ToLower(method) {
			case "get", "post", "put", "patch", "delete":
			default:
				continue // path-level keys such as summary or parameters
			}
			key := strings.ToUpper(method) + " " + apiPrefix + path
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
			if !hasExample(op.Responses) {
				problems = append(problems, key+": missing response example")
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

func hasExample(responses map[string]responseSpec) bool {
	for _, resp := range responses {
		for _, media := range resp.Content {
			if len(media.Example) > 0 || len(media.Examples) > 0 {
				return true
			}
		}
	}
	return false
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
const toyDoc = `{"openapi":"3.1.0","paths":{"/extra":{"get":{
  "summary":"s","description":"d","tags":["platform"],
  "responses":{"200":{"description":"ok","content":{"application/json":{"example":{"ok":true}}}}}}}}}`

const toyDocNoExample = `{"openapi":"3.1.0","paths":{"/extra":{"get":{
  "summary":"s","description":"d","tags":["platform"],
  "responses":{"200":{"description":"ok"}}}}}}`

func toyRouter() chi.Router {
	r := chi.NewRouter()
	r.Get("/api/core/v1/extra", http.NotFound)
	return r
}

func TestContractNamesUndocumentedRoute(t *testing.T) {
	problems := contractProblems(toyRouter(), []byte(`{"openapi":"3.1.0","paths":{}}`))
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

func containsProblem(problems []string, name string) bool {
	for _, p := range problems {
		if strings.Contains(p, name) {
			return true
		}
	}
	return false
}
