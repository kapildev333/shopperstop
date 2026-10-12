package catalog

import (
	"regexp"
	"strings"
)

var notSlugRune = regexp.MustCompile(`[^a-z0-9]+`)

// slugify turns a name into a slug: lower-case ASCII letters and digits joined
// by single hyphens, at most 60 bytes, or fallback when nothing is left.
func slugify(name, fallback string) string {
	s := strings.Trim(notSlugRune.ReplaceAllString(strings.ToLower(name), "-"), "-")
	if len(s) > 60 {
		s = strings.TrimRight(s[:60], "-")
	}
	if s == "" {
		return fallback
	}
	return s
}

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// pattern is the ilike pattern for a search: q with \, % and _ matched
// literally, wrapped in % on both sides.
func pattern(q string) string {
	return "%" + likeEscaper.Replace(q) + "%"
}
