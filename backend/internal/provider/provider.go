package provider

import (
	"context"
)

type Role string 
const (
	RoleSystem Role = "system"
	RoleUser Role = "user"
	RoleAssistant Role = "assistant"
)

type Message struct {
	Role Role 
	Message string 
}

type Request struct {
	SystemPrompt string 
	MessageHistory []Message 
	Model string 
}

type StreamEvent struct {
	Delta string 
	Err error
}

type Provider interface {
	Stream(ctx context.Context, req Request) (<-chan StreamEvent, error)
}