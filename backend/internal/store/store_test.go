package store

import (
	"path/filepath"
	"testing"
)

// newTestStore opens an isolated on-disk SQLite DB per test. WAL needs a
// writable parent directory (it creates -wal/-shm sidecars), so t.TempDir() is
// required rather than an in-memory DSN.
func newTestStore(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "council-test.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func TestOpenSucceeds(t *testing.T) {
	s := newTestStore(t)
	if s == nil || s.db == nil {
		t.Fatal("expected an open store with a db handle")
	}
}

func TestOpenEmptyPathErrors(t *testing.T) {
	if _, err := Open(""); err == nil {
		t.Fatal("Open(\"\") should fail fast")
	}
	if _, err := Open("   "); err == nil {
		t.Fatal("Open(whitespace) should fail fast")
	}
}

// Opening the same file twice exercises CREATE TABLE IF NOT EXISTS idempotency:
// the second Open re-runs migrate against an existing table.
func TestOpenMigrateIdempotent(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "council.db")

	first, err := Open(path)
	if err != nil {
		t.Fatalf("first Open: %v", err)
	}
	if err := first.Close(); err != nil {
		t.Fatalf("first Close: %v", err)
	}

	second, err := Open(path)
	if err != nil {
		t.Fatalf("second Open (migrate re-run): %v", err)
	}
	t.Cleanup(func() { _ = second.Close() })
}
