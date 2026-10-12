// Package migrations embeds the core database's SQL files, applied by
// internal/migrate in file-name order.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
