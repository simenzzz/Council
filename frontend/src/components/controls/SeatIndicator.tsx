// SeatIndicator — the console's "who's about to answer" readout: five pips, one
// per council seat, each lit in that persona's neon accent, plus a mono status
// line. This is the form's signature element — it turns an abstract input into
// "you're convening these five voices". Hues come from the persona registry
// (design/tokens.ts, the single source of truth), never hardcoded here.
//
// The pips are statically colored (color IS the identity, not motion); the neon
// bloom fades in only on group hover/focus of the enclosing form, so nothing
// animates while idle.

import { MODERATOR_ID, PANELISTS, accentOf, personaMeta } from "../../personas/registry";
import type { PersonaId } from "../../design/tokens";

// Seating order: the four debaters, then the moderator who synthesizes last.
const SEATS: readonly PersonaId[] = [...PANELISTS, MODERATOR_ID];

export function SeatIndicator() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5" role="group" aria-label="Council seats">
        {SEATS.map((id) => {
          const meta = personaMeta[id];
          const name = `${meta.displayName} — ${meta.role}`;
          return (
            <span
              key={id}
              // role="img" — a bare <span> is name-prohibited, so aria-label
              // wouldn't reliably reach AT without a naming-capable role.
              role="img"
              title={name}
              aria-label={name}
              style={{ "--pip": accentOf(id) } as React.CSSProperties}
              className="h-2 w-2 rounded-full bg-[var(--pip)] shadow-[0_0_0_0_var(--pip)] transition-[box-shadow] duration-300 group-hover:shadow-[0_0_10px_-1px_var(--pip)] group-focus-within:shadow-[0_0_10px_-1px_var(--pip)]"
            />
          );
        })}
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
        Council · {SEATS.length} seats ready
      </span>
    </div>
  );
}
