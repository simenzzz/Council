package provider

import (
	"context"
)

type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

type Message struct {
	Role    Role
	Message string
}

type Request struct {
	SystemPrompt   string
	MessageHistory []Message
	Model          string
	Temperature    *float64
}

type StreamEvent struct {
	Delta string
	Err   error
	Usage TokenUsage
}

type Provider interface {
	Stream(ctx context.Context, req Request) (<-chan StreamEvent, error)
}

type TokenUsage struct {
	InputTokens  int64
	OutputTokens int64
}
