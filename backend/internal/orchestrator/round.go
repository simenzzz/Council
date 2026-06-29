package orchestrator

type RoundKind int

const (
	RoundStatement RoundKind = iota
	RoundRebuttal
)

func kindOfRound(nbr int) RoundKind {
	if nbr%2 == 1 {
		return RoundStatement
	}
	return RoundRebuttal
}
