package store

import (
	"context"
	"fmt"
)

// upsertUsage bumps (ip, day) by one and hands back the resulting count in a
// single statement. Doing the read-modify-write inside SQLite is what makes the
// quota race-free: two concurrent connections cannot both read 29 and both
// write 30, the way an app-side SELECT-then-UPDATE would allow.
const upsertUsage = `
INSERT INTO daily_usage (ip, day, count)
VALUES (?, ?, 1)
ON CONFLICT(ip, day) DO UPDATE SET count = count + 1
RETURNING count;
`

// CheckAndIncrement atomically bumps today's counter for ip and reports whether
// the request is within the daily limit.
//
// day is injected (not read from the clock here) so tests can force a rollover;
// callers pass time.Now().UTC().Format("2006-01-02").
//
// Note: an over-limit request still increments (count-then-check). That is fine
// for a soft daily cap and keeps the statement race-free. Callers must pass a
// limit >= 1; a limit <= 0 denies every request.
func (s *Store) CheckAndIncrement(ctx context.Context, ip, day string, limit int) (allowed bool, err error) {
	var count int
	if err := s.db.QueryRowContext(ctx, upsertUsage, ip, day).Scan(&count); err != nil {
		// Deliberately omit ip from the error: it is client-controlled and ends
		// up in server logs.
		return false, fmt.Errorf("store: increment quota for day %q: %w", day, err)
	}
	return count <= limit, nil
}
