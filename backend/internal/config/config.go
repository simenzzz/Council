package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr           string
	AllowedOrigins []string
	ZaiAPIKey      string // required; fail-fast; NEVER logged
	LlmModel       string // default "glm-4.7"

	// Phase 5: per-IP rate limiting, global capacity, and durable daily quota.
	RateLimitRPS          float64       // per-IP token refill (tokens/sec)
	RateLimitBurst        int           // per-IP bucket size
	RateLimitTTL          time.Duration // idle IP entry retention; janitor evicts after
	RateLimitSweepEvery   time.Duration // janitor sweep interval
	MaxConcurrentSessions int           // global WS-session semaphore (concurrent debates)
	DailyQuota            int           // per-IP debates/day cap (soft, count-then-check)
	DBPath                string        // SQLite path or file::memory: URI
	TrustProxy            bool          // trust leftmost X-Forwarded-For (only behind a proxy you control)
}

func Load() (Config, error) {
	zKey := os.Getenv("ZAI_API_KEY")
	if zKey == "" {
		return Config{}, errors.New("ZAI_API_KEY is required")
	}

	rps, err := envFloat("RATE_LIMIT_RPS", 1.0)
	if err != nil {
		return Config{}, err
	}
	if rps <= 0 {
		return Config{}, fmt.Errorf("RATE_LIMIT_RPS must be > 0, got %v", rps)
	}

	burst, err := envInt("RATE_LIMIT_BURST", 3)
	if err != nil {
		return Config{}, err
	}
	if burst < 1 {
		return Config{}, fmt.Errorf("RATE_LIMIT_BURST must be >= 1, got %d", burst)
	}

	ttl, err := envDuration("RATE_LIMIT_TTL", 10*time.Minute)
	if err != nil {
		return Config{}, err
	}
	if ttl <= 0 {
		return Config{}, fmt.Errorf("RATE_LIMIT_TTL must be > 0, got %v", ttl)
	}

	sweep, err := envDuration("RATE_LIMIT_SWEEP", time.Minute)
	if err != nil {
		return Config{}, err
	}
	if sweep <= 0 {
		return Config{}, fmt.Errorf("RATE_LIMIT_SWEEP must be > 0, got %v", sweep)
	}

	maxSessions, err := envInt("MAX_CONCURRENT_SESSIONS", 6)
	if err != nil {
		return Config{}, err
	}
	if maxSessions < 1 {
		return Config{}, fmt.Errorf("MAX_CONCURRENT_SESSIONS must be >= 1, got %d", maxSessions)
	}

	quota, err := envInt("DAILY_QUOTA", 20)
	if err != nil {
		return Config{}, err
	}
	if quota < 1 {
		return Config{}, fmt.Errorf("DAILY_QUOTA must be >= 1, got %d", quota)
	}

	trustProxy, err := envBool("TRUST_PROXY", false)
	if err != nil {
		return Config{}, err
	}

	return Config{
		Addr:                  orDefault(os.Getenv("BACKEND_ADDR"), ":8080"),
		AllowedOrigins:        parseOrigins(os.Getenv("FRONTEND_ORIGINS")),
		ZaiAPIKey:             zKey,
		LlmModel:              orDefault(os.Getenv("LLM_MODEL"), "glm-4.7"),
		RateLimitRPS:          rps,
		RateLimitBurst:        burst,
		RateLimitTTL:          ttl,
		RateLimitSweepEvery:   sweep,
		MaxConcurrentSessions: maxSessions,
		DailyQuota:            quota,
		DBPath:                orDefault(os.Getenv("DB_PATH"), "./council.db"),
		TrustProxy:            trustProxy,
	}, nil
}

func orDefault(v string, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}

// envInt reads key as an int. An unset variable yields def; a set-but-invalid
// value is a configuration error (fail fast at the boundary).
func envInt(key string, def int) (int, error) {
	v := os.Getenv(key)
	if v == "" {
		return def, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return 0, fmt.Errorf("%s: invalid integer %q: %w", key, v, err)
	}
	return n, nil
}

func envFloat(key string, def float64) (float64, error) {
	v := os.Getenv(key)
	if v == "" {
		return def, nil
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return 0, fmt.Errorf("%s: invalid float %q: %w", key, v, err)
	}
	return f, nil
}

func envDuration(key string, def time.Duration) (time.Duration, error) {
	v := os.Getenv(key)
	if v == "" {
		return def, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return 0, fmt.Errorf("%s: invalid duration %q: %w", key, v, err)
	}
	return d, nil
}

func envBool(key string, def bool) (bool, error) {
	v := os.Getenv(key)
	if v == "" {
		return def, nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return false, fmt.Errorf("%s: invalid boolean %q: %w", key, v, err)
	}
	return b, nil
}

func parseOrigins(raw string) []string {
	if raw == "" {
		return []string{"localhost:5173"}
	}

	parts := strings.Split(raw, ",")

	var origins []string

	for _, part := range parts {
		trimmed := strings.TrimSpace(part)

		if trimmed == "" {
			continue
		}

		origins = append(origins, trimmed)
	}
	return origins
}
