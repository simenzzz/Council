package orchestrator

import (
	"strings"
)

type personaAnswer struct {
	PersonaID string
	Name      string
	Text      string
}

type Round struct {
	Number  int
	Answers []personaAnswer
}

type Transcript struct {
	rounds []Round
}

func (t Transcript) Append(round Round) Transcript {
	curr := append([]Round(nil), t.rounds...) // copy t.rounds
	curr = append(curr, round)

	return Transcript{
		rounds: curr,
	}
}

func (t Transcript) othersFor(personaID string) []personaAnswer {
	if len(t.rounds) == 0 {
		return nil
	}
	latest := t.rounds[len(t.rounds)-1]
	var ans []personaAnswer
	for _, answer := range latest.Answers {
		if answer.PersonaID == personaID {
			continue
		}
		ans = append(ans, personaAnswer{PersonaID: answer.PersonaID, Name: answer.Name, Text: answer.Text})
	}
	return ans
}

func (t Transcript) ownLatest(personaID string) (personaAnswer, bool) {
	if len(t.rounds) == 0 {
		return personaAnswer{}, false
	}
	latest := t.rounds[len(t.rounds)-1]
	for _, answer := range latest.Answers {
		if answer.PersonaID == personaID {
			return answer, true
		}
	}
	return personaAnswer{}, false
}

func renderAnswers(answers []personaAnswer) string {
	var b strings.Builder
	for _, a := range answers {
		if a.Text == "" {
			continue
		}
		b.WriteString("[" + a.Name + "]: " + a.Text + "\n\n")
	}
	return b.String()
}

// render flattens the entire debate (all rounds) into text for the moderator.
func (t Transcript) render() string {
	var b strings.Builder
	for _, r := range t.rounds {
		// TODO (optional): a round header, e.g. "— Round " + N + " —\n"
		b.WriteString(renderAnswers(r.Answers))
	}
	return b.String()
}
