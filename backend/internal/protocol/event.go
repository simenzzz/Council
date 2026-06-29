package protocol

type EventType string

const (
	EventToken         EventType = "token"
	EventPersonaDone   EventType = "persona_done"
	EventRoundComplete EventType = "round_complete"
	EventError         EventType = "error"
	EventVerdict       EventType = "verdict"
)

type Event struct {
	Type       EventType `json:"type"`
	Persona    string    `json:"persona,omitempty"`
	Round      int       `json:"round,omitempty"`
	Delta      string    `json:"delta,omitempty"`   // token output
	ErrMessage string    `json:"error,omitempty"`   // error msg
	Verdict    string    `json:"verdict,omitempty"` // judge verdict
}

func Token(persona string, round int, delta string) Event {
	return Event{Type: EventToken, Round: round, Delta: delta, Persona: persona}
}
func PersonaDone(persona string, round int) Event {
	return Event{Type: EventPersonaDone, Round: round, Persona: persona}
}
func RoundComplete(round int) Event {
	return Event{Type: EventRoundComplete, Round: round}
}
func Error(persona string, errMsg string) Event {
	return Event{Type: EventError, Persona: persona, ErrMessage: errMsg}
}
func Verdict(text string) Event {
	return Event{Type: EventVerdict, Verdict: text}
}
