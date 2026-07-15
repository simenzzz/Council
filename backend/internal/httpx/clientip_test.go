package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientIP(t *testing.T) {
	tests := []struct {
		name       string
		remoteAddr string
		xff        string
		trustProxy bool
		want       string
	}{
		{"direct host:port", "1.2.3.4:5678", "", false, "1.2.3.4"},
		{"direct ipv6 brackets", "[::1]:443", "", false, "::1"},
		{"direct no port", "1.2.3.4", "", false, "1.2.3.4"},
		{"direct empty -> unknown", "", "", false, unknownIP},

		{"xff leftmost when trusted", "10.0.0.1:99", "9.9.9.9, 8.8.8.8, 7.7.7.7", true, "9.9.9.9"},
		{"xff trimmed when trusted", "10.0.0.1:99", "  203.0.113.5 ", true, "203.0.113.5"},
		{"no xff, trusted -> remoteaddr", "5.5.5.5:1", "", true, "5.5.5.5"},
		{"blank xff, trusted -> remoteaddr", "5.5.5.5:1", "   ", true, "5.5.5.5"},
		{"malformed xff -> remoteaddr (no junk key)", "10.0.0.1:99", "attacker1", true, "10.0.0.1"},
		{"leading-comma xff -> remoteaddr", "10.0.0.1:99", ", 1.2.3.4", true, "10.0.0.1"},
		{"non-ipv4 xff ipv6 trusted", "10.0.0.1:99", "2001:db8::1", true, "2001:db8::1"},

		// Spoof protection: an untrusted deployment MUST ignore X-Forwarded-For
		// and key on the actual peer, or any client could mint a fresh bucket.
		{"xff ignored when untrusted", "10.0.0.1:99", "9.9.9.9", false, "10.0.0.1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.RemoteAddr = tt.remoteAddr
			if tt.xff != "" {
				r.Header.Set("X-Forwarded-For", tt.xff)
			}

			if got := ClientIP(r, tt.trustProxy); got != tt.want {
				t.Errorf("ClientIP() = %q, want %q", got, tt.want)
			}
		})
	}
}
