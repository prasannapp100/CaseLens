/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck -- functional workspace data is normalized from heterogeneous Sarvam responses.
"use client"

import {
  AlertTriangle, ArrowRight, BookOpen, Bot, Check, Clock3, FileAudio,
  FileText, FileVideo, FolderOpen, Languages, LoaderCircle, MessageSquareText,
  Search, Send, ShieldCheck, Sparkles, Upload, Users, X,
  Plus, MessageCircle,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

export default function MainWorkspace() {
  const [section, setSection] = useState("Overview")
  const [store, setStore] = useState({ collections: [], items: [] })
  const [cases, setCases] = useState([])
  const [selected, setSelected] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [answerSources, setAnswerSources] = useState([])
  const [chatSessions, setChatSessions] = useState([])
  const [activeChatId, setActiveChatId] = useState("")
  const [asking, setAsking] = useState(false)
  const [strength, setStrength] = useState(null)
  const [scoring, setScoring] = useState(false)

  async function refresh() {
    const [knowledgeResponse, casesResponse] = await Promise.all([fetch("/api/knowledge"), fetch("/api/case-analyze")])
    const [knowledge, caseData] = await Promise.all([knowledgeResponse.json(), casesResponse.json()])
    setStore({ collections: knowledge.collections || [], items: knowledge.items || [] })
    setCases(caseData.cases || [])
  }

  useEffect(() => {
    Promise.all([fetch("/api/knowledge"), fetch("/api/case-analyze")])
      .then(async ([knowledgeResponse, casesResponse]) => {
        const [knowledge, caseData] = await Promise.all([knowledgeResponse.json(), casesResponse.json()])
        setStore({ collections: knowledge.collections || [], items: knowledge.items || [] })
        setCases(caseData.cases || [])
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("caselens-chat-sessions") || "[]")
        if (saved.length) { setChatSessions(saved); setActiveChatId(saved[0].id) }
        else createChat()
      } catch { createChat() }
    })
  }, [])

  useEffect(() => {
    if (chatSessions.length) localStorage.setItem("caselens-chat-sessions", JSON.stringify(chatSessions))
  }, [chatSessions])

  function createChat() {
    const session = { id: crypto.randomUUID(), title: "New evidence chat", messages: [], createdAt: new Date().toISOString() }
    setChatSessions(current => [session, ...current])
    setActiveChatId(session.id)
    setAnswer(""); setAnswerSources([]); setQuestion("")
  }

  const events = useMemo(() => cases.flatMap(item => item.events.map(event => ({ ...event, caseTitle: item.title }))), [cases])
  const contradictions = useMemo(() => cases.flatMap(item => {
    const claims = new Map(item.claims.map(claim => [claim.id, claim]))
    return item.contradictions.map(conflict => ({
      ...conflict,
      caseTitle: item.title,
      sourceRefs: conflict.claimIds.map(id => claims.get(id)?.sourceRef).filter(Boolean),
    }))
  }), [cases])
  const missingEvidence = useMemo(() => cases.flatMap(item => item.missingEvidence.map(gap => ({ ...gap, caseTitle: item.title }))), [cases])
  const entities = useMemo(() => cases.flatMap(item => item.entities), [cases])

  async function buildEvidenceGraph(items) {
    const evidenceText = items
      .map(item => {
        const timed = item.segments?.length
          ? item.segments.map(segment => `[${item.fileName} • ${formatTime(segment.start)}–${formatTime(segment.end)}${segment.speaker ? ` • ${segment.speaker}` : ""}] ${segment.text}`).join("\n")
          : item.translatedText || item.transcript
        return `[SOURCE FILE: ${item.fileName}]\n${timed}`
      })
      .join("\n\n")
      .slice(0, 175000)
    const analysisBody = new FormData()
    analysisBody.append("file", new File([evidenceText], `evidence-batch-${Date.now()}.txt`, { type: "text/plain" }))
    const response = await fetch("/api/case-analyze", { method: "POST", body: analysisBody })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || "Evidence graph extraction failed.")
    return result
  }

  async function rebuildGraph() {
    if (!store.items.length) return
    setProcessing(true); setError(""); setProgress("Extracting claims and timeline events from stored evidence…")
    try {
      await buildEvidenceGraph(store.items)
      await refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Evidence graph extraction failed.") }
    finally { setProcessing(false); setProgress("") }
  }

  async function processEvidence(files, options = { translate: true, language: "en-IN" }) {
    setProcessing(true); setError("")
    try {
      const items = []
      const skipped = []
      const media = files.filter(file => file.type.startsWith("audio/") || file.type.startsWith("video/"))
      const documents = files.filter(file => /\.(pdf|png|jpe?g|zip)$/i.test(file.name))
      const texts = files.filter(file => file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt"))
      if (media.length) {
        setProgress(`Uploading ${media.length} media files as one Sarvam batch…`)
        const body = new FormData()
        media.forEach(file => body.append("files", file))
        body.append("translateTranscript", String(options.translate)); body.append("targetLanguage", options.language)
        const response = await fetch("/api/batch-process", { method: "POST", body })
        const data = await response.json().catch(() => ({}))
        if (response.ok && Array.isArray(data.items)) items.push(...data.items)
        else skipped.push(`Media: ${data.error || "processing skipped"}`)
      }
      for (let index = 0; index < documents.length; index++) {
        setProgress(`Digitizing document ${index + 1} of ${documents.length} with Sarvam…`)
        const body = new FormData(); body.append("file", documents[index]); body.append("language", options.language)
        try {
          const response = await fetch("/api/document-process", { method: "POST", body })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.error || "digitization skipped")
          items.push(data)
        } catch (caught) { skipped.push(`${documents[index].name}: ${caught instanceof Error ? caught.message : "skipped"}`) }
      }
      for (let index = 0; index < texts.length; index++) {
        setProgress(`Reading TXT ${index + 1} of ${texts.length}…`)
        items.push({ fileName: texts[index].name, mediaType: "text/plain", transcript: await texts[index].text() })
      }
      if (!items.length) throw new Error("Choose audio, video, WhatsApp TXT, PDF, image, ZIP, or TXT evidence.")
      setProgress("Extracting claims and timeline events from every source…")
      try { await buildEvidenceGraph(items) } catch (caught) { skipped.push(`Knowledge graph: ${caught instanceof Error ? caught.message : "skipped"}`) }
      setProgress("Creating a grounded summary…")
      const summaryResponse = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) })
      const summary = await summaryResponse.json().catch(() => ({ summary: `${items.length} evidence sources processed.` }))
      setProgress("Saving to the knowledge base…")
      const saveResponse = await fetch("/api/knowledge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: files.length === 1 ? files[0].name : `${files.length} evidence files`, summary: summary.summary, items }),
      })
      const saved = await saveResponse.json()
      if (!saveResponse.ok) throw new Error(saved.error || "Save failed.")
      await refresh()
      if (skipped.length) console.warn("CaseLens skipped non-fatal processing errors:", skipped)
      setShowUpload(false); setSection("Overview")
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Processing failed.") }
    finally { setProcessing(false); setProgress("") }
  }

  async function ask() {
    if (!question.trim()) return
    const sessionId = activeChatId || chatSessions[0]?.id
    const session = chatSessions.find(item => item.id === sessionId)
    const userMessage = { id: crypto.randomUUID(), role: "user", content: question, createdAt: new Date().toISOString() }
    const history = session?.messages || []
    setChatSessions(current => current.map(item => item.id === sessionId ? { ...item, title: item.messages.length ? item.title : question.slice(0, 42), messages: [...item.messages, userMessage] } : item))
    const sentQuestion = question
    setQuestion(""); setAsking(true); setAnswer(""); setAnswerSources([]); setError("")
    try {
      const response = await fetch("/api/knowledge-query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: sentQuestion, history: history.map(({ role, content }) => ({ role, content })) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Question failed.")
      setAnswer(data.answer)
      setAnswerSources(data.sources || [])
      const assistantMessage = { id: crypto.randomUUID(), role: "assistant", content: data.answer, sources: data.sources || [], createdAt: new Date().toISOString() }
      setChatSessions(current => current.map(item => item.id === sessionId ? { ...item, messages: [...item.messages, assistantMessage] } : item))
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Question failed.") }
    finally { setAsking(false) }
  }

  async function assessStrength() {
    setScoring(true); setError("")
    try {
      const response = await fetch("/api/case-strength", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Assessment failed.")
      setStrength(data)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Assessment failed.") }
    finally { setScoring(false) }
  }

  const nav = [
    ["Overview", BookOpen], ["Evidence", FolderOpen], ["Timeline", Clock3],
    ["Contradictions", AlertTriangle], ["Ask CaseLens", Bot], ["Case brief", FileText],
  ]

  return <main className="min-h-screen bg-[#f5f5f2] text-[#20231f]">
    <header className="flex h-16 items-center justify-between border-b border-black/10 bg-white px-6">
      <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-[#183f31] font-serif font-bold text-white">C</div><span className="font-serif text-xl font-semibold">CaseLens</span></div>
      <div className="flex gap-x-4">
        
      <div className="flex items-center gap-3"><Link href="/matter" className="rounded-lg border px-3 py-2 text-xs font-semibold">matter</Link></div>
      <div className="flex items-center gap-2"><Link href="/media" className="rounded-lg border px-3 py-2 text-xs font-semibold">Media</Link><Link href="/digitize" className="rounded-lg bg-[#183f31] px-3 py-2 text-xs font-semibold text-white">Digitize sources</Link></div>
      <div className="flex items-center gap-3"><Link href="/cases" className="rounded-lg border px-3 py-2 text-xs font-semibold">CASES</Link></div>
      </div>

    </header>
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-[220px_1fr]">
      <aside className="border-r border-black/8 bg-white p-4">
        <nav className="space-y-1">{nav.map(([label, Icon]) => <button key={label} onClick={() => setSection(label)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${section === label ? "bg-[#eaf2ed] font-semibold text-[#285c47]" : "text-[#687069] hover:bg-black/4"}`}><Icon size={16} />{label}</button>)}</nav>
        <button onClick={() => setShowUpload(true)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#183f31] px-3 py-2.5 text-sm font-semibold text-white"><Upload size={15} /> Add evidence</button>
        <div className="mt-6 border-t pt-4 text-xs leading-6 text-[#7d847e]"><p>{store.items.length} actual sources</p><p>{events.length} extracted events</p><p>{contradictions.length} possible conflicts</p></div>
      </aside>
      <section className="min-w-0 p-7">
        {section === "Overview" && <Overview collections={store.collections} items={store.items} cases={cases} strength={strength} scoring={scoring} onAssess={assessStrength} onUpload={() => setShowUpload(true)} />}
        {section === "Evidence" && <Evidence items={store.items} selected={selected} onSelect={setSelected} />}
        {section === "Timeline" && <Timeline events={events} canBuild={store.items.length > 0} processing={processing} onBuild={rebuildGraph} />}
        {section === "Contradictions" && <Conflicts contradictions={contradictions} gaps={missingEvidence} />}
        {section === "Ask CaseLens" && <Ask question={question} setQuestion={setQuestion} ask={ask} sessions={chatSessions} activeId={activeChatId} setActiveId={setActiveChatId} createChat={createChat} items={store.items} onSelect={(item) => { setSelected(item); setSection("Evidence") }} asking={asking} />}
        {section === "Case brief" && <Brief collections={store.collections} cases={cases} items={store.items} />}
        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </section>
    </div>
    {showUpload && <UploadModal processing={processing} progress={progress} error={error} onClose={() => !processing && setShowUpload(false)} onProcess={processEvidence} />}
  </main>
}

function PageHead({ title, text }) { return <div className="mb-6"><h1 className="font-serif text-3xl font-semibold">{title}</h1><p className="mt-1 text-sm text-[#777e78]">{text}</p></div> }
function formatTime(seconds) { const value = Math.max(0, Math.floor(Number(seconds) || 0)); return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}` }
function Empty({ onUpload, text = "No actual evidence has been processed yet." }) { return <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-white text-center"><div><FolderOpen className="mx-auto mb-3 text-[#809087]" /><p className="text-sm text-[#727a73]">{text}</p>{onUpload && <button onClick={onUpload} className="mt-4 rounded-lg bg-[#183f31] px-4 py-2 text-sm font-semibold text-white">Upload evidence</button>}</div></div> }

function Overview({ collections, items, cases, strength, scoring, onAssess, onUpload }) {
  return <><PageHead title="Case workspace" text="Only processed evidence appears in this workspace." />{!items.length ? <Empty onUpload={onUpload} /> : <div className="space-y-5"><StrengthCard assessment={strength} loading={scoring} onAssess={onAssess} /><div className="grid gap-4 sm:grid-cols-3"><Metric value={items.length} label="Evidence sources" /><Metric value={cases.reduce((n, item) => n + item.claims.length, 0)} label="Atomic claims" /><Metric value={cases.reduce((n, item) => n + item.events.length, 0)} label="Timeline events" /></div>{collections.map(collection => <article key={collection.id} className="rounded-2xl border border-black/8 bg-white p-5"><p className="text-xs font-bold tracking-wider text-[#39745d] uppercase">Sarvam summary</p><h2 className="mt-2 font-serif text-xl font-semibold">{collection.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#59615b]">{collection.summary}</p></article>)}</div>}</>
}
function StrengthCard({ assessment, loading, onAssess }) {
  if (!assessment) return <section className="flex items-center justify-between rounded-2xl border border-[#d8d0c2] bg-[#fffdf9] p-6"><div><p className="text-[11px] font-bold tracking-[.15em] text-[#855139] uppercase">Evidence strength</p><h2 className="mt-2 font-serif text-2xl">How well supported is this case?</h2><p className="mt-1 text-sm text-[#747873]">Score coverage and consistency—not the chance of winning.</p></div><button onClick={onAssess} disabled={loading} className="rounded-full bg-[#183f31] px-5 py-2.5 text-xs font-bold text-white">{loading ? "Assessing…" : "Calculate score"}</button></section>
  return <section className="rounded-2xl border border-[#d8d0c2] bg-[#fffdf9] p-6"><div className="grid gap-7 lg:grid-cols-[180px_1fr]"><div className="text-center lg:border-r"><div className="mx-auto grid size-32 place-items-center rounded-full border-[9px] border-[#dfe9e3]"><div><b className="font-serif text-4xl">{assessment.score}</b><span className="text-sm text-[#788078]">/100</span></div></div><p className="mt-3 text-sm font-bold text-[#356d56]">{assessment.label}</p></div><div><div className="flex items-center justify-between"><p className="text-[11px] font-bold tracking-[.15em] text-[#855139] uppercase">Evidence coverage score</p><button onClick={onAssess} className="text-xs font-semibold text-[#356d56]">Recalculate</button></div><p className="mt-3 text-sm leading-6 text-[#626862]">{assessment.explanation}</p><div className="mt-5 grid gap-3 sm:grid-cols-5">{assessment.dimensions.map(item => <div key={item.name}><div className="flex justify-between text-[10px] font-semibold"><span>{item.name}</span><b>{item.score}</b></div><div className="mt-1 h-1.5 rounded-full bg-[#e7e8e3]"><div className="h-full rounded-full bg-[#547a67]" style={{ width: `${item.score}%` }} /></div></div>)}</div></div></div><div className="mt-6 grid gap-4 border-t pt-5 md:grid-cols-3"><ScoreList title="Strongest support" items={assessment.strengths} tone="green" /><ScoreList title="Weaknesses" items={assessment.weaknesses} tone="amber" /><ScoreList title="Get next" items={assessment.nextBestEvidence} tone="blue" /></div><p className="mt-5 text-[10px] text-[#8b908b]">This assesses uploaded evidence coverage only. It is not legal advice or a prediction of case outcome.</p></section>
}
function ScoreList({ title, items, tone }) { return <div><p className="text-xs font-bold">{title}</p><ul className="mt-2 space-y-2">{items.map((item, index) => <li key={index} className="text-xs leading-5 text-[#666d67]">• {item}</li>)}</ul></div> }
function Metric({ value, label }) { return <div className="rounded-2xl border border-black/8 bg-white p-5"><b className="font-serif text-3xl">{value}</b><p className="mt-1 text-xs text-[#7d847e]">{label}</p></div> }

function Evidence({ items, selected, onSelect }) {
  return <><PageHead title="Evidence" text={`${items.length} processed sources`} />{!items.length ? <Empty /> : <div className="grid gap-5 lg:grid-cols-[1fr_460px]"><div className="space-y-2">{items.map(item => <button key={item.id} onClick={() => onSelect(item)} className="flex w-full items-center gap-3 rounded-xl border border-black/8 bg-white p-4 text-left hover:border-[#739180]">{item.mediaType.includes("video") ? <FileVideo /> : item.mediaType.includes("audio") ? <FileAudio /> : item.mediaType.includes("text") ? <MessageSquareText /> : <FileText />}<div className="min-w-0"><p className="truncate text-sm font-semibold">{item.fileName}</p><p className="mt-1 text-xs text-[#7c837d]">{item.languageCode || item.mediaType}{item.segments?.length ? ` · ${item.segments.length} timed segments` : ""}</p></div><Check className="ml-auto text-[#39805e]" size={15} /></button>)}</div>{selected ? <article className="max-h-[72vh] overflow-auto rounded-xl border bg-white p-6"><p className="text-[11px] font-bold tracking-[.14em] text-[#79503b] uppercase">Verified source</p><h2 className="mt-2 font-serif text-2xl font-semibold">{selected.fileName}</h2>{selected.segments?.length ? <div className="mt-6 space-y-1">{selected.segments.map((segment, index) => <div key={index} className="grid grid-cols-[72px_1fr] gap-3 border-t py-3"><button className="text-left text-xs font-semibold text-[#39745d]">{formatTime(segment.start)}</button><div><p className="text-sm leading-6">{segment.text}</p>{segment.speaker && <p className="mt-1 text-[10px] font-bold text-[#858c86] uppercase">{segment.speaker}</p>}</div></div>)}</div> : <>{selected.translatedText && <><p className="mt-5 text-xs font-bold text-[#39745d] uppercase">Translation</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selected.translatedText}</p></>}<p className="mt-5 text-xs font-bold text-[#39745d] uppercase">Extracted source</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selected.transcript}</p></>}</article> : <Empty text="Select a source to inspect its actual extracted content." />}</div>}</>
}
function Timeline({ events, canBuild, processing, onBuild }) { return <section className="rounded-[18px] border border-black/8 bg-[#fffefc] p-7 shadow-[0_10px_35px_rgba(45,39,31,.05)]"><div className="flex items-start justify-between border-b pb-6"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#855139] uppercase">Reconstructed chronology</p><h1 className="mt-2 font-serif text-3xl">Case timeline</h1></div><div className="flex items-center gap-3"><span className="rounded-full border bg-[#fafaf7] px-3 py-1.5 text-[10px] font-bold tracking-wider text-[#666b66] uppercase">{events.length} events</span>{canBuild && <button onClick={onBuild} disabled={processing} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase">{processing ? <LoaderCircle className="animate-spin" size={13} /> : <Sparkles size={13} />} Analyze</button>}</div></div>{!events.length ? <div className="mt-6"><Empty text="No events extracted yet. Analyze stored audio, video, PDF, and TXT evidence." /></div> : <div className="relative mt-7 before:absolute before:top-5 before:bottom-8 before:left-5 before:w-px before:bg-[#ced0ca]">{events.map((event, index) => <article key={`${event.id}-${index}`} className="relative grid grid-cols-[42px_1fr] gap-7 pb-11"><div className="relative z-10 grid size-10 place-items-center rounded-full border border-[#c8cac5] bg-[#fffefc] font-serif text-sm">{index + 1}</div><div className="pt-1"><div className="flex flex-wrap items-center gap-3"><b className="text-sm">{event.date === "unknown" ? "Date not established" : event.date}</b><span className="rounded-full border bg-[#fafaf7] px-2.5 py-1 text-[10px] font-bold text-[#6f746f] uppercase">{event.date === "unknown" ? "Inferred" : "Exact"}</span></div><h2 className="mt-3 font-serif text-[26px] leading-tight">{event.title}</h2><p className="mt-2 text-sm leading-7 text-[#6c716c]">{event.description}</p><div className="mt-3 flex flex-wrap gap-2">{event.sourceRefs.map((source, sourceIndex) => <span key={sourceIndex} className="inline-flex items-center gap-1.5 rounded-md bg-[#f0f1ed] px-2.5 py-1.5 text-[11px] text-[#525952]"><LinkIcon />{source}</span>)}</div></div></article>)}</div>}</section> }
function LinkIcon() { return <span className="text-sm">↗</span> }
function Conflicts({ contradictions, gaps }) { return <><PageHead title="Contradictions & gaps" text="Sarvam-generated review leads, not legal conclusions." />{!contradictions.length && !gaps.length ? <Empty text="No contradictions or missing evidence have been extracted." /> : <div className="grid gap-5 lg:grid-cols-2"><div className="space-y-3">{contradictions.map((item, index) => <article key={index} className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase">{item.severity} relevance · {item.caseTitle}</p><h2 className="mt-2 font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-6">{item.explanation}</p><p className="mt-2 text-xs font-semibold text-[#7b5b16]">{item.sourceRefs.length ? `Sources: ${item.sourceRefs.join(" · ")}` : `Claims: ${item.claimIds.join(" · ")}`}</p></article>)}</div><div className="space-y-3">{gaps.map((item, index) => <article key={index} className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-bold uppercase">{item.importance} importance · {item.caseTitle}</p><h2 className="mt-2 font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-6">{item.reason}</p><p className="mt-2 text-xs font-semibold text-red-800">Mentioned in: {item.mentionedIn.join(" · ")}</p></article>)}</div></div>}</> }
function Ask({ question, setQuestion, ask, sessions, activeId, setActiveId, createChat, items, onSelect, asking }) {
  const active = sessions.find(item => item.id === activeId)
  return <><PageHead title="Ask CaseLens" text="Persistent, source-grounded conversations with follow-up memory." /><div className="grid min-h-[68vh] overflow-hidden rounded-2xl border bg-white lg:grid-cols-[230px_1fr]"><aside className="border-r bg-[#f8f8f5] p-3"><button onClick={createChat} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#183f31] px-3 py-2.5 text-xs font-semibold text-white"><Plus size={14} />New chat</button><div className="mt-3 space-y-1">{sessions.map(session => <button key={session.id} onClick={() => setActiveId(session.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs ${activeId === session.id ? "bg-[#e5eee9] font-semibold text-[#285c47]" : "text-[#687069] hover:bg-black/5"}`}><MessageCircle size={14} /><span className="truncate">{session.title}</span></button>)}</div></aside><div className="flex min-h-0 flex-col"><div className="flex-1 space-y-4 overflow-auto p-5">{active?.messages?.length ? active.messages.map(message => <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[80%]" : "mr-auto max-w-[88%]"}><div className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[#183f31] text-white" : "bg-[#f0f4f1]"}`}>{message.content}</div>{message.sources?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{message.sources.map(source => <button key={source.id} onClick={() => onSelect(items.find(item => item.fileName === source.fileName))} className="rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold text-[#356d56]">SOURCE-{source.id} · {source.fileName}</button>)}</div>}</div>) : <div className="grid h-full place-items-center text-center"><div><Bot className="mx-auto text-[#789084]" /><p className="mt-3 text-sm font-semibold">Start a new evidence conversation</p><p className="mt-1 text-xs text-[#7b837c]">Follow-ups remember this chat while answers remain grounded in uploaded sources.</p></div></div>}</div><div className="border-t p-4"><div className="flex gap-2"><input value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => event.key === "Enter" && !event.shiftKey && ask()} placeholder="Ask a question or follow up…" className="h-12 flex-1 rounded-xl border px-4 text-sm outline-none" /><button onClick={ask} disabled={asking || !question.trim()} className="grid size-12 place-items-center rounded-xl bg-[#183f31] text-white disabled:opacity-50">{asking ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}</button></div></div></div></div></>
}
function Brief({ collections, cases, items }) { return <><PageHead title="Case brief" text="Built only from uploaded and processed evidence." />{!collections.length ? <Empty /> : <article className="rounded-2xl border bg-white p-7"><h1 className="font-serif text-2xl font-semibold">Evidence brief</h1>{collections.map(collection => { const sources = items.filter(item => collection.itemIds.includes(item.id)); return <section key={collection.id} className="mt-6 border-t pt-5"><h2 className="font-semibold">{collection.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{collection.summary}</p><div className="mt-3 flex flex-wrap gap-2">{sources.map(source => <span key={source.id} className="rounded-md bg-[#edf3ef] px-2.5 py-1.5 text-xs font-semibold text-[#356d56]">{source.fileName}</span>)}</div></section> })}{cases.map(item => <section key={item.id} className="mt-6 border-t pt-5"><h2 className="font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-6">{item.overview}</p><p className="mt-2 text-xs text-[#39745d]">{item.events.flatMap(event => event.sourceRefs).filter((value, index, values) => values.indexOf(value) === index).join(" · ")}</p></section>)}</article>}</> }

function UploadModal({ processing, progress, error, onClose, onProcess }) {
  const [files, setFiles] = useState([])
  const [translate, setTranslate] = useState(true)
  const [language, setLanguage] = useState("en-IN")
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/45 p-5"><div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"><button onClick={onClose} disabled={processing} className="float-right"><X /></button><div className="grid size-11 place-items-center rounded-xl bg-[#e9f2ed] text-[#356d56]"><Upload /></div><h2 className="mt-4 font-serif text-2xl font-semibold">{processing ? "Processing actual evidence…" : "Add all evidence"}</h2><p className="mt-2 text-sm text-[#707871]">{processing ? progress : "One place for video transcription, translation, WhatsApp exports, scans, documents, audio, and text."}</p>{processing ? <div className="mt-8 flex items-center gap-3 rounded-xl bg-[#f2f5f2] p-4 text-sm"><LoaderCircle className="animate-spin" />{progress}</div> : <><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Video/audio","Transcribe"],["WhatsApp TXT","Analyze"],["PDF/scans","Digitize"],["ZIP/TXT","Extract"]].map(([title, action]) => <div key={title} className="rounded-xl border bg-[#fafaf8] p-3"><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-[10px] text-[#7f8781]">{action} with Sarvam</p></div>)}</div><label className="mt-4 grid min-h-40 cursor-pointer place-items-center rounded-xl border border-dashed bg-[#fafaf8] text-center"><div><Upload className="mx-auto mb-3 text-[#39745d]" /><b className="text-sm">{files.length ? `${files.length} files selected` : "Choose mixed evidence files"}</b><p className="mt-1 text-xs text-[#8a918b]">Audio, video, WhatsApp TXT, PDF, JPG, PNG, ZIP</p></div><input type="file" multiple accept=".pdf,.txt,.png,.jpg,.jpeg,.zip,audio/*,video/*" className="hidden" onChange={event => setFiles(Array.from(event.target.files || []))} /></label><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="rounded-xl border p-3"><span className="text-xs font-semibold">Translation language</span><select value={language} onChange={event => setLanguage(event.target.value)} className="mt-2 w-full bg-transparent text-sm outline-none"><option value="en-IN">English</option><option value="hi-IN">Hindi</option><option value="kn-IN">Kannada</option><option value="ta-IN">Tamil</option><option value="te-IN">Telugu</option><option value="bn-IN">Bengali</option><option value="mr-IN">Marathi</option><option value="ml-IN">Malayalam</option><option value="gu-IN">Gujarati</option><option value="pa-IN">Punjabi</option></select></label><label className="flex items-center justify-between rounded-xl border p-3"><span><span className="block text-xs font-semibold">Translate transcripts</span><span className="text-[10px] text-[#858c86]">Keep original and translated text</span></span><input type="checkbox" checked={translate} onChange={event => setTranslate(event.target.checked)} className="size-4 accent-[#183f31]" /></label></div><button onClick={() => onProcess(files, { translate, language })} disabled={!files.length} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#183f31] text-sm font-semibold text-white disabled:opacity-50"><Sparkles size={16} /> Process everything with Sarvam <ArrowRight size={15} /></button></>}{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</div></div>
}
