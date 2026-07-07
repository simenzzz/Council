// textReveal — the pure word-by-word chunking rule shared by DebatePlayer's live
// pacing and the replay overlay's static re-reveal, so "how a turn is typed out"
// is defined in exactly one place.

function isSpace(ch: string): boolean {
  return ch === " " || ch === "\n" || ch === "\t" || ch === "\r";
}

/** End index of the next word (plus its trailing whitespace) from `pos`. Never
 *  stalls: always advances by at least one character. */
export function nextChunkEnd(text: string, pos: number): number {
  let i = pos;
  while (i < text.length && !isSpace(text[i])) i++; // the word
  while (i < text.length && isSpace(text[i])) i++; // its trailing spaces
  return i > pos ? i : Math.min(text.length, pos + 1);
}
