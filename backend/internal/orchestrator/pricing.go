package orchestrator

import (
	"log/slog"

	"github.com/simenzzz/council/backend/internal/provider"
)

// Prices are in US dollars per one million tokens.
// Source: https://docs.z.ai/guides/overview/pricing, read on 2026-10-17.
// TokenUsage has no cached-input split, so the table uses the full input
// price. Prices change; read the page again when the model changes.
type pricePerMillion struct {
	Input  float64
	Output float64
}

var prices = map[string]pricePerMillion{
	"glm-4.7": {Input: 0.60, Output: 2.20},
	"glm-4.6": {Input: 0.60, Output: 2.20},
}

// turnCost returns the cost of one turn in US dollars. An unknown model logs
// one warning and returns 0. A missing price must not stop a debate.
func turnCost(model string, usage provider.TokenUsage, logger *slog.Logger) float64 {
	price, ok := prices[model]
	if !ok {
		logger.Warn("no price for the model; the cost is 0", "model", model)
		return 0
	}
	inputCost := float64(usage.InputTokens) / 1_000_000 * price.Input
	outputCost := float64(usage.OutputTokens) / 1_000_000 * price.Output
	return inputCost + outputCost
}
