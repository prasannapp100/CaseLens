"use client"

import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  FileText,
  GitBranch,
  HelpCircle,
  LoaderCircle,
  Search,
  ShieldAlert,
  Upload,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { MarkdownContent } from "@/components/markdown-content"

type Analysis = {
  id: string
  title: string
  overview: string
  entities: Array<{ id: string; name: string; type: string; aliases: string[] }>
  claims: Array<{
    id: string
    claim: string
    speaker: string
    eventDate: string
    sourceRef: string
    confidence: number
  }>
  events: Array<{
    id: string
    title: string
    date: string
    description: string
    sourceRefs: string[]
  }>
  contradictions: Array<{
    title: string
    explanation: string
    claimIds: string[]
    severity: string
  }>
  missingEvidence: Array<{
    title: string
    reason: string
    mentionedIn: string[]
    importance: string
  }>
}

export default function CasesPage() {
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [question, setQuestion] = useState("")
  const [theory, setTheory] = useState("")
  const [answer, setAnswer] = useState("")
  const [asking, setAsking] = useState(false)

  async function analyze() {
    if (!file) return
    setLoading(true)
    setError("")
    const body = new FormData()
    body.append("file", file)
    try {
      const response = await fetch("/api/case-analyze", {
        method: "POST",
        body,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Analysis failed.")
      setAnalysis(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.")
    } finally {
      setLoading(false)
    }
  }

  async function ask(kind: "question" | "theory" | "attack") {
    if (!analysis) return
    setAsking(true)
    setAnswer("")
    setError("")
    try {
      const response = await fetch("/api/case-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: analysis.id,
          question: kind === "question" ? question : undefined,
          theory: kind !== "question" ? theory : undefined,
          attack: kind === "attack",
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Query failed.")
      setAnswer(data.answer)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Query failed.")
    } finally {
      setAsking(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#1c1d1a]">
      <header className="border-b border-black/8 bg-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5">
          <Link
            href="/main"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <ArrowLeft size={16} /> Case workspace
          </Link>
          <span className="flex items-center gap-2 font-serif text-lg font-semibold">
            <ShieldAlert size={18} className="text-[#356d56]" /> CaseLens
          </span>
          <Link href="/media" className="text-xs font-semibold text-[#356d56]">
            Media processing
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-[1200px] px-5 py-10">
        <p className="text-xs font-bold tracking-[.12em] text-[#39745d] uppercase">
          Evidence intelligence
        </p>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">
          Turn chats into a traceable case model.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6d746e]">
          Upload a WhatsApp TXT export. Sarvam extracts entities, atomic claims,
          events, contradictions, missing evidence and source citations.
        </p>

        {!analysis && (
          <section className="mt-8 max-w-2xl rounded-2xl border border-black/9 bg-white p-6 shadow-sm">
            <label className="grid min-h-48 cursor-pointer place-items-center rounded-xl border border-dashed border-[#cbd1ca] bg-[#fafaf8] text-center">
              <div>
                <Upload className="mx-auto mb-3 text-[#356d56]" />
                <p className="text-sm font-semibold">
                  {file ? file.name : "Choose a WhatsApp TXT export"}
                </p>
                <p className="mt-1 text-xs text-[#8a918b]">
                  Plain .txt export, without media
                </p>
              </div>
              <input
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            {error && <ErrorMessage text={error} />}
            <button
              onClick={analyze}
              disabled={!file || loading}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#183f31] text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" /> Building
                  evidence graph…
                </>
              ) : (
                <>
                  <Brain size={16} /> Analyze with Sarvam
                </>
              )}
            </button>
          </section>
        )}

        {analysis && (
          <div className="mt-8 grid items-start gap-5 lg:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <Card icon={<FileText />} title={analysis.title}>
                <p className="text-sm leading-6 text-[#566059]">
                  {analysis.overview}
                </p>
              </Card>
              <Card
                icon={<GitBranch />}
                title={`Timeline · ${analysis.events.length} events`}
              >
                <div className="space-y-3">
                  {analysis.events.map((event) => (
                    <div
                      key={event.id}
                      className="border-l-2 border-[#7ea38f] pl-4"
                    >
                      <div className="flex gap-2 text-xs text-[#788078]">
                        <b>{event.id}</b>
                        <span>{event.date}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold">
                        {event.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#6f776f]">
                        {event.description}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">{event.sourceRefs.map((source, index) => <Link key={index} href={`/main?source=${encodeURIComponent(source)}`} className="rounded bg-[#edf3ef] px-1.5 py-1 text-[10px] text-[#39745d] hover:underline">↗ {source}</Link>)}</div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card
                icon={<Brain />}
                title={`Atomic claims · ${analysis.claims.length}`}
              >
                <div className="space-y-2">
                  {analysis.claims.map((claim) => (
                    <details
                      key={claim.id}
                      className="rounded-lg bg-[#f6f7f4] px-3 py-2"
                    >
                      <summary className="cursor-pointer text-sm">
                        <b className="mr-2 text-[#39745d]">{claim.id}</b>
                        {claim.claim}
                      </summary>
                      <p className="mt-2 text-xs text-[#747b75]">
                        Speaker: {claim.speaker} · Date: {claim.eventDate} ·
                        Confidence: {Math.round(claim.confidence * 100)}%
                      </p>
                      <Link href={`/main?source=${encodeURIComponent(claim.sourceRef)}`} className="mt-1 inline-block text-[10px] font-medium text-[#39745d] hover:underline">↗ Source: {claim.sourceRef}</Link>
                    </details>
                  ))}
                </div>
              </Card>
            </div>
            <aside className="space-y-5">
              <Card
                icon={<Users />}
                title={`Entities · ${analysis.entities.length}`}
              >
                <div className="space-y-2">
                  {analysis.entities.map((entity) => (
                    <div
                      key={entity.id}
                      className="rounded-lg bg-[#f6f7f4] p-3"
                    >
                      <p className="text-sm font-semibold">
                        {entity.name}{" "}
                        <span className="text-xs font-normal text-[#8a918b]">
                          {entity.id}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-[#747b75]">
                        {entity.aliases.join(", ") || "No aliases"}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
              <Card
                icon={<AlertTriangle />}
                title={`Contradictions · ${analysis.contradictions.length}`}
              >
                {analysis.contradictions.length ? (
                  analysis.contradictions.map((item, i) => (
                    <div
                      key={i}
                      className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3"
                    >
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs leading-5">
                        {item.explanation}
                      </p>
                      <p className="mt-1 text-[10px]">
                        {item.claimIds.join(" · ")}
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty text="No direct conflicts detected." />
                )}
              </Card>
              <Card
                icon={<Search />}
                title={`Missing evidence · ${analysis.missingEvidence.length}`}
              >
                {analysis.missingEvidence.length ? (
                  analysis.missingEvidence.map((item, i) => (
                    <div
                      key={i}
                      className="mb-2 rounded-lg border border-red-100 bg-red-50 p-3"
                    >
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs leading-5">{item.reason}</p>
                    </div>
                  ))
                ) : (
                  <Empty text="No obvious missing documents detected." />
                )}
              </Card>
            </aside>
            <section className="rounded-2xl border border-black/9 bg-white p-5 lg:col-span-2">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <HelpCircle size={16} /> Grounded Q&A
                  </p>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="What supports the payment claim?"
                    className="h-24 w-full resize-none rounded-xl border p-3 text-sm outline-none"
                  />
                  <button
                    onClick={() => ask("question")}
                    disabled={!question || asking}
                    className="mt-2 rounded-lg bg-[#183f31] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Ask with citations
                  </button>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <ShieldAlert size={16} /> Case theory
                  </p>
                  <textarea
                    value={theory}
                    onChange={(e) => setTheory(e.target.value)}
                    placeholder="The client completed all payments before termination."
                    className="h-24 w-full resize-none rounded-xl border p-3 text-sm outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => ask("theory")}
                      disabled={!theory || asking}
                      className="rounded-lg bg-[#183f31] px-4 py-2 text-xs font-semibold text-white"
                    >
                      Evaluate
                    </button>
                    <button
                      onClick={() => ask("attack")}
                      disabled={!theory || asking}
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700"
                    >
                      Attack my theory
                    </button>
                  </div>
                </div>
              </div>
              {asking && (
                <p className="mt-5 flex items-center gap-2 text-sm">
                  <LoaderCircle size={15} className="animate-spin" /> Reasoning
                  over the evidence graph…
                </p>
              )}
              {answer && (
                <div className="mt-5 rounded-xl bg-[#f2f5f1] p-4">
                  <MarkdownContent content={answer} compact />
                </div>
              )}
              {error && <ErrorMessage text={error} />}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-black/9 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#35463d]">
        <span className="[&>svg]:size-4 [&>svg]:text-[#39745d]">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}
function Empty({ text }: { text: string }) {
  return <p className="text-xs text-[#858b85]">{text}</p>
}
function ErrorMessage({ text }: { text: string }) {
  return (
    <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {text}
    </p>
  )
}
