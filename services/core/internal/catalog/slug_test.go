package catalog

import (
	"strings"
	"testing"
)

func TestSlugify(t *testing.T) {
	cases := []struct{ name, want string }{
		{"Fruits & Vegetables", "fruits-vegetables"},
		{"  Dairy, Bread & Eggs ", "dairy-bread-eggs"},
		{"100% Juice", "100-juice"},
		{"!!!", "category"},
		{strings.Repeat("a", 100), strings.Repeat("a", 60)},
		// The cut lands on a hyphen: it is trimmed, not left trailing.
		{strings.Repeat("a", 59) + " b", strings.Repeat("a", 59)},
	}
	for _, c := range cases {
		if got := slugify(c.name, "category"); got != c.want {
			t.Errorf("slugify(%q) = %q, want %q", c.name, got, c.want)
		}
	}
}

func TestPattern(t *testing.T) {
	if got, want := pattern(`50%_off\`), `%50\%\_off\\%`; got != want {
		t.Fatalf("pattern: got %q, want %q", got, want)
	}
}
