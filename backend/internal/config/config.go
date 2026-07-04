package config

import (
	"errors"
	"os"
	"strings"
)

type Config struct {
	Addr           string
	AllowedOrigins []string
	ZaiAPIKey      string // required; fail-fast; NEVER logged
	LlmModel       string // default "glm-4.7"
}

func Load() (Config, error) {
	zKey := os.Getenv("ZAI_API_KEY")
	if zKey == "" {
		return Config{}, errors.New("ZAI_API_KEY is required")
	}
	return Config{
		Addr:           orDefault(os.Getenv("BACKEND_ADDR"), ":8080"),
		AllowedOrigins: parseOrigins(os.Getenv("FRONTEND_ORIGINS")),
		ZaiAPIKey:      zKey,
		LlmModel:       orDefault(os.Getenv("LLM_MODEL"), "glm-4.7"),
	}, nil
}

func orDefault(v string, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
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
