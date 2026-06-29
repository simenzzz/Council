package protocol

import (
	"errors"
	"strings"
	"unicode/utf8"
)

const (
	maxQuestionLen = 1000
	DefaultRounds  = 2
	MinRounds      = 2
	MaxRounds      = 8
)

type ClientMessage struct {
	Type     string `json:"type"` // ask
	Question string `json:"question"`
	Rounds   int    `json:"rounds"` // even, min,max
}

func (m ClientMessage) Validate() error {
	if m.Type != "ask" {
		return errors.New(`type must be "ask"`)
	}
	trimmed := strings.TrimSpace(m.Question)
	if trimmed == "" {
		return errors.New("question must be non-empty")
	}
	if !utf8.ValidString(m.Question) {
		return errors.New("invalid question encoding")
	}
	if utf8.RuneCountInString(trimmed) > maxQuestionLen {
		return errors.New("question is too long")
	}
	if m.Rounds != 0 {
		if m.Rounds < MinRounds || m.Rounds > MaxRounds || m.Rounds%2 != 0 {
			return errors.New("invalid round number, choose an even number between 2 and 8")
		}
	}
	return nil
}
