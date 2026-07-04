package store

import "context"

// CheckAndIncrement atomically bumps today's counter for ip and reports whether
// the request is within the daily limit.
//
// A single UPSERT ... RETURNING makes read+increment atomic at the DB level, so
// there is no app-side race even under concurrent connections:
//
//	INSERT INTO daily_usage(ip, day, count) VALUES(?, ?, 1)
//	ON CONFLICT(ip, day) DO UPDATE SET count = count + 1
//	RETURNING count;
//
// day is injected (not read from the clock here) so tests can force a rollover;
// callers pass time.Now().UTC().Format("2006-01-02"). allowed is
// (returnedCount <= limit).
//
// Note: an over-limit request still increments (count-then-check). That is fine
// for a soft daily cap and keeps the statement race-free.
func (s *Store) CheckAndIncrement(ctx context.Context, ip, day string, limit int) (allowed bool, err error) {
	// TODO(you):
	//  - var count int
	//  - err := s.db.QueryRowContext(ctx, `<UPSERT ... RETURNING count>`,
	//      ip, day).Scan(&count)
	//  - if err != nil { return false, err }   // handle explicitly
	//  - return count <= limit, nil
	panic("TODO(you): implement CheckAndIncrement")
}
