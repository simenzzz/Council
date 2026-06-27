package config

import (
	"os"
	"strings"
)
type Config struct {
	Addr string 
	AllowedOrigins []string 
}

func Load() Config {
	return Config {
		Addr: orDefault(os.Getenv("BACKEND_ADDR"), ":8080"),
		AllowedOrigins: parseOrigins(os.Getenv("FRONTEND_ORIGINS")),
	}
}

func orDefault(v string, fallback string) string {
	if v==""{
		return fallback
	}
	return v
}

func parseOrigins (raw string) []string {
	if raw ==""{
		return []string{"localhost:5173"}
	}
	
	parts := strings.Split(raw, ",")

	var origins []string

	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		
		if trimmed == ""{
			continue 
		}

		origins = append(origins, trimmed)
	}
	return origins 
}