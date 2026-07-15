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
	// Only consult X-Forwarded-For behind a proxy we control; otherwise any
	// client could spoof the header and mint itself a fresh rate-limit bucket.
	// A blank or malformed header yields "" and falls through to RemoteAddr.
	if trustProxy {
		if forwarded := extractFFIP(r); forwarded != "" {
			return forwarded
		}
	}

	rawAddr := strings.TrimSpace(r.RemoteAddr)
	if rawAddr == "" {
		return unknownIP
	}

	// The common case: RemoteAddr is "host:port". Key on the host alone — the
	// ephemeral port differs on every connection, so keying on it would give
	// each connection its own bucket and defeat the limiter entirely.
	// SplitHostPort (not a ":" split) is what makes IPv6 "[::1]:port" work.
	if host, _, err := net.SplitHostPort(rawAddr); err == nil && host != "" {
		return host
	}

	// No port, or an address SplitHostPort can't parse: the raw value is still
	// a stable per-client key, and it is non-empty, so use it.
	return rawAddr
}

func extractFFIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff == "" {
		return ""
	}
	ips := strings.Split(xff, ",")
	firstIP := strings.TrimSpace(ips[0])
	// Reject anything that is not a literal IP. A non-IP leftmost entry (or an
	// empty one from a leading comma) means the header is malformed or spoofed,
	// so fall back to RemoteAddr rather than minting a garbage rate-limit key.
	if net.ParseIP(firstIP) == nil {
		return ""
	}
	return firstIP
}
