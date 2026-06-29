package orchestrator

import (
	"context"
	"log/slog"
	"strings"

	"golang.org/x/sync/errgroup"

	"github.com/simenzzz/council/backend/internal/protocol"
	"github.com/simenzzz/council/backend/internal/provider"
)

type Orchestrator struct {
	provider provider.Provider
	model    string
	limit    int
	logger   *slog.Logger
}

func New(p provider.Provider, model string, limit int, logger *slog.Logger) *Orchestrator {
	if limit <= 0 {
		limit = 1
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Orchestrator{provider: p, model: model, limit: limit, logger: logger}
}

func (o *Orchestrator) Run(ctx context.Context, question string, personas []protocol.Persona, rounds int) <-chan protocol.Event {
	out := make(chan protocol.Event)
	go func() {
		defer close(out)
		var transcript Transcript
		for round := 1; round <= rounds; round++ {
			answers := o.runRound(ctx, round, transcript, personas, question, out)
			transcript = transcript.Append(Round{Number: round, Answers: answers})
			if !emit(ctx, out, protocol.RoundComplete(round)) {
				return
			}
		}
		o.runModerator(ctx, question, transcript, rounds+1, out)
	}()
	return out
}

func (o *Orchestrator) runRound(ctx context.Context, round int, prior Transcript, personas []protocol.Persona, question string, out chan<- protocol.Event) []personaAnswer {
	answers := make([]personaAnswer, len(personas))
	var g errgroup.Group
	g.SetLimit(o.limit)
	for i, p := range personas {
		g.Go(func() error {
			req := o.buildRequest(p, prior, round, question)
			text := o.stream(ctx, p, round, req, false, out)
			answers[i] = personaAnswer{PersonaID: p.ID, Name: p.Name, Text: text}
			return nil
		})
	}
	_ = g.Wait()
	return answers
}

func (o *Orchestrator) buildRequest(persona protocol.Persona, prior Transcript, round int, question string) provider.Request {
	msgs := []provider.Message{{Role: provider.RoleUser, Message: question}}

	if round > 1 {
		own, ok := prior.ownLatest(persona.ID)
		if ok {
			msgs = append(msgs, provider.Message{
				Role:    provider.RoleAssistant,
				Message: own.Text,
			})
		}
		var sysInstruction string
		if kindOfRound(round) == RoundStatement {
			sysInstruction = "Having heard the others, sharpen and restate YOUR position."
		} else {
			sysInstruction = "Directly rebut the other panelists' latest points below."
		}
		otherMsgs := renderAnswers(prior.othersFor(persona.ID))
		msgs = append(msgs, provider.Message{Role: provider.RoleUser, Message: sysInstruction + "\n\n" + otherMsgs})

	}
	return provider.Request{
		SystemPrompt:   persona.SystemPrompt,
		MessageHistory: msgs,
		Model:          o.model,
	}

}

func (o *Orchestrator) stream(
	ctx context.Context, persona protocol.Persona, round int,
	req provider.Request, isModerator bool, out chan<- protocol.Event,
) string {
	stream, err := o.provider.Stream(ctx, req)
	if err != nil {
		o.logger.Error("stream start failed", "persona", persona.ID, "err", err)
		emit(ctx, out, protocol.Error(persona.ID, "stream failed"))
		return ""
	}

	var b strings.Builder
	for ev := range stream {
		if ev.Err != nil {
			o.logger.Error("stream failed", "persona", persona.ID, "err", ev.Err)
			emit(ctx, out, protocol.Error(persona.ID, "stream failed"))
			return b.String()
		}
		b.WriteString(ev.Delta)
		if !emit(ctx, out, protocol.Token(persona.ID, round, ev.Delta)) {
			return b.String()
		}
	}

	if isModerator {
		emit(ctx, out, protocol.Verdict(b.String()))
	} else {
		emit(ctx, out, protocol.PersonaDone(persona.ID, round))
	}
	return b.String()
}

func (o *Orchestrator) runModerator(ctx context.Context, question string, transcript Transcript, round int, out chan<- protocol.Event) {
	moderator := protocol.Moderator()
	prompt := question + "\n\n" + transcript.render()
	req := provider.Request{
		SystemPrompt:   moderator.SystemPrompt,
		MessageHistory: []provider.Message{{Role: provider.RoleUser, Message: prompt}},
		Model:          o.model,
	}
	o.stream(ctx, moderator, round, req, true, out)
}

func emit(ctx context.Context, out chan<- protocol.Event, ev protocol.Event) bool {
	select {
	case <-ctx.Done():
		return false
	case out <- ev:
		return true
	}
}
