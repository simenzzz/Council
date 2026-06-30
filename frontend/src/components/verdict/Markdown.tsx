// Markdown — a thin, safe wrapper around react-markdown for rendering the
// moderator's verdict. remark-gfm adds tables/strikethrough/task-lists; we do
// NOT enable rehype-raw, so embedded HTML is rendered as escaped text — the
// verdict text is untrusted model output and must never inject markup.

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Token-styled renderers. Each ignores react-markdown's `node` prop and styles
// with the chamber palette + type roles from theme.css.
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 font-display text-2xl font-semibold text-ink first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 font-display text-xl font-semibold text-ink first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 font-display text-lg font-semibold text-ink first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="my-2 leading-relaxed text-ink/90">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-ink/90">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-ink/90">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-moderator underline underline-offset-2 hover:text-ink"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-moderator/60 pl-3 text-muted italic">
      {children}
    </blockquote>
  ),
  // react-markdown v10 dropped the `inline` prop; block code carries a
  // `language-*` className (set by the parser inside <pre>), inline code does
  // not. Only inline code gets the pill so fenced blocks aren't double-styled.
  code: ({ className, children }) =>
    className ? (
      <code className={`${className} font-mono text-sm`}>{children}</code>
    ) : (
      <code className="rounded bg-bg px-1 py-0.5 font-mono text-sm text-moderator">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-panel-border bg-bg p-3 font-mono text-sm">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-panel-border px-2 py-1 text-left font-semibold text-ink">{children}</th>
  ),
  td: ({ children }) => <td className="border border-panel-border px-2 py-1 text-ink/90">{children}</td>,
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
