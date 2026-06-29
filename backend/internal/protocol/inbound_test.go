package protocol

import (
	"strings"
	"testing"
)

func TestClientMessageValidate(t *testing.T) {
	tests := []struct {
		name    string
		msg     ClientMessage
		wantErr bool
	}{
		{"valid, rounds omitted (defaults later)", ClientMessage{Type: "ask", Question: "why?"}, false},
		{"valid, even rounds", ClientMessage{Type: "ask", Question: "why?", Rounds: 4}, false},
		{"valid, max rounds", ClientMessage{Type: "ask", Question: "why?", Rounds: MaxRounds}, false},
		// 1000 multibyte runes = 3000 bytes: passes the rune check, but would have
		// failed the old byte-based length check — the reason for the fix.
		{"valid, multibyte at limit", ClientMessage{Type: "ask", Question: strings.Repeat("あ", maxQuestionLen)}, false},

		{"wrong type", ClientMessage{Type: "chat", Question: "hi"}, true},
		{"empty question (whitespace)", ClientMessage{Type: "ask", Question: "   "}, true},
		{"question too long (runes)", ClientMessage{Type: "ask", Question: strings.Repeat("a", maxQuestionLen+1)}, true},
		{"invalid utf8", ClientMessage{Type: "ask", Question: string([]byte{0xff, 0xfe, 0xfd})}, true},
		{"odd rounds", ClientMessage{Type: "ask", Question: "hi", Rounds: 3}, true},
		{"rounds over max", ClientMessage{Type: "ask", Question: "hi", Rounds: MaxRounds + 2}, true},
		{"rounds below min", ClientMessage{Type: "ask", Question: "hi", Rounds: -2}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.msg.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
