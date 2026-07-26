"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function MarkdownContent({ content, compact = false }: { content: string; compact?: boolean }) {
  const source = String(content || "").trim()
  const shortened = compact && source.length > 1400
    ? `${source.slice(0, 1400).replace(/\s+\S*$/, "")}\n\n…`
    : source

  return <div className="case-markdown text-sm leading-6 text-[#4f5b54]">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h2 className="mt-5 mb-3 font-serif text-2xl font-semibold text-[#202720] first:mt-0">{children}</h2>,
        h2: ({ children }) => <h3 className="mt-5 mb-2 flex items-center gap-2 border-b border-black/7 pb-2 text-[11px] font-bold tracking-[.14em] text-[#7e4f39] uppercase first:mt-0">{children}</h3>,
        h3: ({ children }) => <h4 className="mt-4 mb-2 font-semibold text-[#273029]">{children}</h4>,
        p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="my-3 grid gap-2">{children}</ul>,
        ol: ({ children }) => <ol className="my-3 grid list-decimal gap-2 pl-5">{children}</ol>,
        li: ({ children }) => <li className="rounded-lg border border-black/6 bg-[#f8f9f6] px-3 py-2 marker:font-bold marker:text-[#47715e]">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-[#202a23]">{children}</strong>,
        blockquote: ({ children }) => <blockquote className="my-3 rounded-r-lg border-l-3 border-[#547c68] bg-[#edf4f0] px-4 py-2 text-[#3f584b]">{children}</blockquote>,
        table: ({ children }) => <div className="my-4 overflow-x-auto rounded-xl border"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
        th: ({ children }) => <th className="border-b bg-[#f0f3ef] px-3 py-2 font-semibold">{children}</th>,
        td: ({ children }) => <td className="border-b px-3 py-2 align-top">{children}</td>,
      }}
    >{shortened}</ReactMarkdown>
    {shortened && <p className="mt-3 text-[10px] font-semibold tracking-wide text-[#89918b] uppercase">AI-generated · verify against cited evidence</p>}
  </div>
}
