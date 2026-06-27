package provider

import (
	"bufio"         // bufio.Scanner — read SSE line by line
	"bytes"         // bytes.NewReader — wrap the JSON body for the request
	"context"       // context.Context type for the ctx param
	"encoding/json" // json.Marshal (request), json.Unmarshal (each chunk)
	"fmt"           // fmt.Errorf — build error messages
	"io"            // io.LimitReader, io.ReadAll — bounded read of error bodies
	"net/http"      // http.Client, http.NewRequestWithContext, http.MethodPost, http.StatusOK
	"strings"       // strings.HasPrefix, strings.TrimPrefix — parse "data: " lines
)

type ZaiProvider struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

type wireMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type wireRequest struct {
	Model    string        `json:"model"`
	Messages []wireMessage `json:"messages"`
	Stream   bool          `json:"stream"`
	Thinking struct {
		Type string `json:"type"`
	} `json:"thinking"`
}

type wireChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
}

var _ Provider = (*ZaiProvider)(nil)

func NewZaiProvider(apiKey string, model string) *ZaiProvider {
	return &ZaiProvider{
		apiKey:     apiKey,
		baseURL:    "https://api.z.ai/api/paas/v4/chat/completions",
		model:      model,
		httpClient: &http.Client{},
	}
}

func (z *ZaiProvider) Stream(ctx context.Context, req Request) (<-chan StreamEvent, error) {
	messages := make([]wireMessage, 0, len(req.MessageHistory)+1)
	if req.SystemPrompt != "" {
		messages = append(messages, wireMessage{Role: "system", Content: req.SystemPrompt})
	}
	for _, msg := range req.MessageHistory {
		messages = append(messages, wireMessage{Role: string(msg.Role), Content: msg.Message})
	}

	model := req.Model
	if model == "" {
		model = z.model
	}

	body := wireRequest{
		Model:    model,
		Messages: messages,
		Stream:   true,
	}
	body.Thinking.Type = "disabled"

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		z.baseURL,
		bytes.NewReader(jsonBody),
	)
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+z.apiKey)
	httpReq.Header.Set("Accept", "text/event-stream")

	out := make(chan StreamEvent)
	go func() {
		defer close(out)
		z.streamResponse(ctx, httpReq, out)
	}()
	return out, nil

}

func (z *ZaiProvider) streamResponse(ctx context.Context, httpReq *http.Request, out chan<- StreamEvent) {
	resp, err := z.httpClient.Do(httpReq)
	if err != nil {
		select {
		case <-ctx.Done():
		case out <- StreamEvent{Err: err}:
		}
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 2*1024))
		select {
		case <-ctx.Done():
		case out <- StreamEvent{Err: fmt.Errorf("zai: status %d: %s", resp.StatusCode, snippet)}:
		}
		return
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		text := scanner.Text()

		if text == "" || !strings.HasPrefix(text, "data: ") { // skip blanks + non-data
			continue
		}

		data := strings.TrimPrefix(text, "data: ")
		if data == "[DONE]" {
			return
		}

		var chunk wireChunk

		err := json.Unmarshal([]byte(data), &chunk)
		if err != nil {
			continue
		}
		if len(chunk.Choices) == 0 {
			continue
		}

		content := chunk.Choices[0].Delta.Content

		if content == "" {
			continue
		}

		select {
		case <-ctx.Done():
			return
		case out <- StreamEvent{Delta: content, Err: nil}:
		}
	}

	err2 := scanner.Err()
	if err2 != nil {
		select {
		case <-ctx.Done():
		case out <- StreamEvent{Err: err2}:
		}
		return
	}
}
