// Package migrations embeds the rider database's SQL files, applied by
// internal/migrate in file-name order.
// Copied from services/core at 5335efc (D31).
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
