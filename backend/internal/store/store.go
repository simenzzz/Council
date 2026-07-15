package store

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	_ "modernc.org/sqlite" // registers the pure-Go "sqlite" driver (no cgo)
)

// busyTimeoutMS bounds how long SQLite waits on a lock held by another *process*
// (the WAL checkpointer, a second container, a sqlite3 CLI) before returning
// SQLITE_BUSY. Contention between our own goroutines never reaches SQLite: the
// pool is capped at one connection, so they queue in database/sql instead.
const busyTimeoutMS = 5000

// schema is the one table backing the per-IP daily quota. WITHOUT ROWID stores
// the row directly in the primary-key B-tree — the right shape for a pure
// composite-key lookup table that never uses an implicit rowid.
const schema = `
CREATE TABLE IF NOT EXISTS daily_usage (
	ip    TEXT    NOT NULL,
	day   TEXT    NOT NULL,
	count INTEGER NOT NULL,
	PRIMARY KEY (ip, day)
) WITHOUT ROWID;
`

// Store wraps the SQLite handle used for the durable per-IP daily quota. It is
// the Phase 6 persistence on-ramp — kept intentionally minimal (one table).
type Store struct {
	db *sql.DB
}

// Open opens (creating if needed) the SQLite database at path and runs the
// migration. It fails fast on an unusable path.
//
// path is a filename ("./council.db") or a URI ("file::memory:"); either way the
// pragmas are appended as DSN query parameters rather than issued as Exec
// statements. That matters: busy_timeout is a *per-connection* setting, so an
// Exec would configure only whichever pooled connection happened to serve it,
// and would be silently lost if the pool ever reopened that connection. DSN
// _pragma values are applied by the driver in newConn, so every connection —
// including reopened ones — gets them.
//
// WAL creates council.db-wal and council.db-shm sidecar files, so the parent
// directory must be writable, not just the database file.
func Open(path string) (*Store, error) {
	if strings.TrimSpace(path) == "" {
		return nil, errors.New("store: database path is empty")
	}

	db, err := sql.Open("sqlite", buildDSN(path))
	if err != nil {
		return nil, fmt.Errorf("store: open %q: %w", path, err)
	}

	// SQLite permits exactly one writer. Capping the pool at a single connection
	// makes concurrent callers block in database/sql rather than race into a
	// SQLITE_BUSY error we would then have to retry. This must happen before the
	// first query, or the pool may briefly open a second connection.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	// sql.Open is lazy — it never touched the disk. Ping is the fail-fast point.
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("store: ping %q: %w", path, err)
	}

	if err := migrate(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("store: migrate: %w", err)
	}

	return &Store{db: db}, nil
}

// buildDSN appends the pragma query parameters to path, preserving any query
// parameters the caller already supplied. It assumes path does not already carry
// _pragma parameters (the default DB_PATH and test paths are bare filenames);
// duplicate pragmas would otherwise be appended verbatim.
func buildDSN(path string) string {
	sep := "?"
	if strings.Contains(path, "?") {
		sep = "&"
	}
	return fmt.Sprintf("%s%s_pragma=busy_timeout(%d)&_pragma=journal_mode(WAL)", path, sep, busyTimeoutMS)
}

// Close releases the underlying database handle.
func (s *Store) Close() error {
	return s.db.Close()
}

// migrate creates the usage table if it does not already exist. Inline DDL is
// fine for a single table; graduate to embedded migrations in Phase 6.
func migrate(db *sql.DB) error {
	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("create daily_usage: %w", err)
	}
	return nil
}
