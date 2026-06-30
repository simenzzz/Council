// Header — the chamber's masthead. The eyebrow names the subject; the title
// carries the display face. Kept deliberately quiet so the live debate and the
// verdict spotlight remain the page's loud moments.

export function Header() {
  return (
    <header className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
        A panel convenes
      </p>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Council
      </h1>
      <p className="max-w-2xl text-sm text-muted">
        Ask once. Four minds answer and rebut each other across rounds, live — then the Moderator
        hands down a verdict.
      </p>
    </header>
  );
}
