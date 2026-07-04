package httpx

import (
	"net"
	"net/http"
	"strings"
)

// unknownIP is the sentinel returned when no client IP can be determined. Using
// a fixed non-empty value means callers (rate limiter, quota) bucket unknowns
// together rather than treating "" as a distinct bypass key.
const unknownIP = "unknown"

// ClientIP returns the best-effort client IP for r.
//
// When trustProxy is false, it uses r.RemoteAddr (the direct peer) — correct
// for local/dev and any setup where the app is directly exposed.
//
// When trustProxy is true, it trusts the LEFTMOST X-Forwarded-For entry set by
// the front proxy (Render/Fly terminate TLS and prepend the real client IP).
// Only enable behind a proxy you control, or clients can spoof XFF.
//
// It never returns "": unresolvable IPs collapse to unknownIP.
func ClientIP(r *http.Request, trustProxy bool) string {
	// TODO(you):
	//  - if trustProxy and r.Header.Get("X-Forwarded-For") != "":
	//      split on ",", take the FIRST entry, strings.TrimSpace, return it
	//      (if non-empty).
	//  - else: net.SplitHostPort(r.RemoteAddr) → return host; if SplitHostPort
	//      errors (no port), fall back to a trimmed r.RemoteAddr.
	//  - anything empty → return unknownIP.
	//
	// Helpers already imported for you: net.SplitHostPort, strings.Split,
	// strings.TrimSpace.
	_ = net.SplitHostPort
	_ = strings.Split
	panic("TODO(you): implement ClientIP")
}
