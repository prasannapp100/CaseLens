/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck -- report data is normalized from heterogeneous persisted evidence.
"use client"

import { ArrowLeft, FileAudio, FileText, FileVideo, LoaderCircle, Send, ShieldCheck, Sparkles } from "lucide-react"
import Link from "next/link"
import { MarkdownContent } from "@/components/markdown-content"
import { useEffect, useMemo, useState } from "react"

export default function MatterPage() {
  const [knowledge, setKnowledge] = useState({ collections: [], items: [] })
  const [cases, setCases] = useState([])
  const [strength, setStrength] = useState(null)
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    try {
      const [k, c] = await Promise.all([fetch("/api/knowledge"), fetch("/api/case-analyze")])
      const [kd, cd] = await Promise.all([k.json(), c.json()])
      setKnowledge({ collections: kd.collections || [], items: kd.items || [] })
      setCases(cd.cases || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { Promise.resolve().then(load) }, [])

  const claims = useMemo(() => cases.flatMap(item => item.claims), [cases])
  const events = useMemo(() => cases.flatMap(item => item.events), [cases])
  const conflicts = useMemo(() => cases.flatMap(item => {
    const claimMap = new Map(item.claims.map(claim => [claim.id, claim]))
    return item.contradictions.map(conflict => ({ ...conflict, sources: conflict.claimIds.map(id => claimMap.get(id)?.sourceRef).filter(Boolean) }))
  }), [cases])
  const gaps = useMemo(() => cases.flatMap(item => item.missingEvidence), [cases])
  const entities = useMemo(() => cases.flatMap(item => item.entities), [cases])
  const title = cases[0]?.title || knowledge.collections[0]?.title || "Untitled matter"
  const overview = cases[0]?.overview || knowledge.collections[0]?.summary || ""

  async function refreshAnalysis() {
    setError("")
    try {
      const response = await fetch("/api/case-strength", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Assessment failed.")
      setStrength(data); await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Refresh failed.") }
  }
  async function ask() {
    if (!question.trim()) return
    setAsking(true); setAnswer("")
    try {
      const response = await fetch("/api/knowledge-query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Question failed.")
      setAnswer(data.answer)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Question failed.") }
    finally { setAsking(false) }
  }

  return <main className="min-h-screen bg-[#f3f3ef] text-[#1e211e]">
    <header className="sticky top-0 z-20 border-b bg-[#f7f7f4]/95 backdrop-blur"><div className="mx-auto flex h-17 max-w-[1380px] items-center justify-between px-7"><div className="flex items-center gap-5"><Link href="/main" className="flex items-center gap-2 text-xs font-semibold"><ArrowLeft size={15} /> Workspace</Link><span className="text-xs text-[#898e89]">Matters&nbsp;&nbsp;/&nbsp;&nbsp;{title}</span></div><div className="flex gap-3"><span className="rounded-full border border-[#c8ded1] bg-[#edf6f1] px-3 py-2 text-[10px] font-bold text-[#39745d] uppercase">Analysis current</span><button onClick={refreshAnalysis} disabled={!knowledge.items.length || loading} className="flex items-center gap-2 rounded-xl bg-[#17251f] px-5 py-2.5 text-xs font-bold text-white"><Sparkles size={15} /> Refresh analysis</button></div></div></header>
    <div className="mx-auto max-w-[1380px] px-7 py-9">
      <h1 className="border-b pb-7 font-serif text-[38px]">Case overview</h1>
      {loading ? <div className="grid min-h-96 place-items-center"><LoaderCircle className="animate-spin" /></div> : !knowledge.items.length ? <div className="mt-10 rounded-2xl border border-dashed bg-white p-16 text-center"><p>No evidence uploaded yet.</p><Link href="/main" className="mt-4 inline-block rounded-lg bg-[#17251f] px-5 py-2.5 text-sm font-semibold text-white">Go to workspace</Link></div> : <div className="mt-10 space-y-6">
        <section className="grid rounded-2xl border bg-white p-10 lg:grid-cols-[1fr_320px]"><div className="pr-10"><p className="eyebrow">Evidence matter</p><h2 className="mt-3 font-serif text-[40px]">{title}</h2><p className="mt-4 whitespace-pre-wrap text-[15px] leading-8 text-[#676e68]">{overview}</p></div><div className="border-l pl-9"><p className="mt-8 text-[11px] tracking-widest text-[#8b908b] uppercase">Source material</p><b className="mt-2 block text-lg">{knowledge.items.length} processed sources</b><p className="mt-7 text-[11px] tracking-widest text-[#8b908b] uppercase">Provenance</p><b className="mt-2 flex items-center gap-2 text-sm"><ShieldCheck size={16} className="text-[#39745d]" /> Linked to uploads</b></div></section>
        <div className="grid gap-4 sm:grid-cols-4"><Metric label="Material claims" value={claims.length} /><Metric label="Timeline events" value={events.length} /><Metric label="Review issues" value={conflicts.length} /><Metric label="Evidence gaps" value={gaps.length} /></div>
        {strength && <Strength data={strength} />}
        <section className="grid gap-5 lg:grid-cols-[1.8fr_1fr]"><Panel kicker="Claim register" title="Evidence-linked claims" count={`${claims.length} claims`}>{claims.map((claim, index) => <article key={index} className="border-b py-6"><div className="flex gap-2"><Pill text={claim.claimType} /><Pill text={claim.speaker || "Unknown"} /></div><p className="mt-4 text-[15px] leading-7">{claim.claim}</p><Source text={claim.sourceRef} /><div className="mt-2 text-right text-xs">{Math.round((claim.confidence || 0) * 100)}% confidence</div></article>)}</Panel><Panel kicker="Entities" title="People and objects">{entities.map((entity, index) => <div key={index} className="flex items-center gap-4 border-b py-5"><div className="grid size-12 place-items-center rounded-full bg-[#eeefeb] font-serif text-xl">{entity.name?.[0]}</div><div><b>{entity.name}</b><p className="text-xs text-[#858b85]">{entity.type} · {entity.aliases?.join(", ")}</p></div></div>)}</Panel></section>
        <Panel kicker="Reconstructed chronology" title="Case timeline" count={`${events.length} events`}><div className="relative before:absolute before:top-5 before:bottom-5 before:left-5 before:w-px before:bg-[#ced0ca]">{events.map((event, index) => <article key={index} className="relative grid grid-cols-[42px_1fr] gap-7 pb-11"><div className="relative z-10 grid size-10 place-items-center rounded-full border bg-white font-serif">{index + 1}</div><div><b className="text-sm">{event.date === "unknown" ? "Date not established" : event.date}</b><h3 className="mt-3 font-serif text-2xl">{event.title}</h3><p className="mt-2 text-sm leading-7 text-[#697069]">{event.description}</p><div className="mt-3 flex flex-wrap gap-2">{event.sourceRefs.map((source, i) => <Source key={i} text={source} />)}</div></div></article>)}</div></Panel>
        <section className="grid gap-5 lg:grid-cols-2"><Panel kicker="Review queue" title="Possible contradictions" count={`${conflicts.length} to review`}>{conflicts.map((item, index) => <article key={index} className="mt-5 rounded-xl border p-5"><Pill text={item.severity} /><h3 className="mt-3 font-serif text-xl">{item.title}</h3><p className="mt-3 text-sm leading-6">{item.explanation}</p><div className="mt-3 flex flex-wrap gap-2">{item.sources.map((source, i) => <Source key={i} text={source} />)}</div></article>)}</Panel><Panel kicker="Collection checklist" title="Missing evidence" count={`${gaps.length} gaps`}>{gaps.map((item, index) => <article key={index} className="border-b py-6"><Pill text={item.importance} /><h3 className="mt-3 font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#687068]">{item.reason}</p><p className="mt-2 text-xs text-[#8b908b]">{item.mentionedIn.join(" · ")}</p></article>)}</Panel></section>
        <Panel kicker="Case brief" title="What matters now">{knowledge.collections.map(collection => <section key={collection.id} className="border-b py-6"><h3 className="font-serif text-xl">{collection.title}</h3><div className="mt-3"><MarkdownContent content={collection.summary} compact /></div><div className="mt-3 flex flex-wrap gap-2">{knowledge.items.filter(item => collection.itemIds.includes(item.id)).map(item => <Source key={item.id} text={item.fileName} />)}</div></section>)}</Panel>
        <Panel kicker="Grounded Q&A" title="Ask this matter"><div className="flex gap-2"><input value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => event.key === "Enter" && ask()} className="h-12 flex-1 rounded-xl border px-4 text-sm" placeholder="Ask about the uploaded evidence…" /><button onClick={ask} className="grid size-12 place-items-center rounded-xl bg-[#17251f] text-white">{asking ? <LoaderCircle className="animate-spin" size={16} /> : <Send size={16} />}</button></div>{answer && <div className="mt-5 rounded-xl bg-[#f1f2ee] p-5"><MarkdownContent content={answer} compact /></div>}</Panel>
      </div>}
      {error && <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    </div>
  </main>
}

function Metric({ label, value }) { return <div className="rounded-xl border bg-white p-7"><p className="text-[11px] tracking-widest uppercase">{label}</p><b className="mt-3 block font-serif text-4xl font-normal">{value}</b></div> }
function Panel({ kicker, title, count, children }) { return <section className="rounded-2xl border bg-white p-8"><div className="flex items-start justify-between border-b pb-6"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#855139] uppercase">{kicker}</p><h2 className="mt-2 font-serif text-3xl">{title}</h2></div>{count && <span className="rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase">{count}</span>}</div>{children}</section> }
function Pill({ text }) { return <span className="rounded-full border bg-[#fafaf7] px-2.5 py-1 text-[10px] font-bold uppercase">{text}</span> }
function Source({ text }) { return <span className="inline-flex rounded-md bg-[#f0f1ed] px-2.5 py-1.5 text-[11px] text-[#505750]">↗ {text}</span> }
function Strength({ data }) { return <section className="rounded-2xl border bg-white p-8"><div className="flex items-center gap-6"><div className="grid size-24 place-items-center rounded-full border-[7px] border-[#dce9e1]"><b className="font-serif text-3xl">{data.score}</b></div><div><p className="text-[11px] font-bold tracking-widest text-[#855139] uppercase">Evidence strength · {data.label}</p><p className="mt-2 text-sm leading-6">{data.explanation}</p></div></div></section> }
