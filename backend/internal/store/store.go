package store

import (
	"database/sql"

	_ "modernc.org/sqlite" // registers the pure-Go "sqlite" driver (no cgo)
)

// Store wraps the SQLite handle used for the durable per-IP daily quota. It is
// the Phase 6 persistence on-ramp — kept intentionally minimal (one table).
type Store struct {
	db *sql.DB
}

// Open opens (creating if needed) the SQLite database at path and runs the
// migration. SQLite is a single-writer engine, so we serialize writes with
// SetMaxOpenConns(1) and enable WAL + a busy timeout to avoid "database is
// locked" under concurrent access.
//
// path may be a file path (e.g. "./council.db") or an in-memory DSN for tests
// (e.g. "file::memory:?cache=shared").
func Open(path string) (*Store, error) {
	// TODO(you):
	//  - db, err := sql.Open("sqlite", path)   // driver name is "sqlite"
	//  - db.SetMaxOpenConns(1)
	//  - exec PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
	//  - db.Ping() to fail fast on a bad path/DSN
	//  - migrate(db)
	//  - return &Store{db: db}, nil (close db on any error path)
	panic("TODO(you): implement Open")
}

// Close releases the underlying database handle.
func (s *Store) Close() error {
	return s.db.Close()
}

// migrate creates the usage table if it does not already exist. Inline DDL is
// fine for a single table; graduate to embedded migrations in Phase 6.
func migrate(db *sql.DB) error {
	// TODO(you): db.Exec(`
	//   CREATE TABLE IF NOT EXISTS daily_usage (
	//     ip    TEXT    NOT NULL,
	//     day   TEXT    NOT NULL,   -- UTC "2006-01-02"
	//     count INTEGER NOT NULL,
	//     PRIMARY KEY (ip, day)
	//   );`)
	panic("TODO(you): implement migrate")
}
