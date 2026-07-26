/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck -- functional workspace data is normalized from heterogeneous Sarvam responses.
"use client"

import {
  AlertTriangle, ArrowRight, BookOpen, Bot, Check, Clock3, FileAudio,
  FileText, FileVideo, FolderOpen, Languages, LoaderCircle, MessageSquareText,
  Search, Send, ShieldCheck, Sparkles, Upload, Users, X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

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
  const [asking, setAsking] = useState(false)

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

  const events = useMemo(() => cases.flatMap(item => item.events.map(event => ({ ...event, caseTitle: item.title }))), [cases])
  const contradictions = useMemo(() => cases.flatMap(item => item.contradictions.map(conflict => ({ ...conflict, caseTitle: item.title }))), [cases])
  const missingEvidence = useMemo(() => cases.flatMap(item => item.missingEvidence.map(gap => ({ ...gap, caseTitle: item.title }))), [cases])
  const entities = useMemo(() => cases.flatMap(item => item.entities), [cases])

  async function processEvidence(files) {
    setProcessing(true); setError("")
    try {
      const items = []
      const media = files.filter(file => file.type.startsWith("audio/") || file.type.startsWith("video/"))
      const pdfs = files.filter(file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
      const texts = files.filter(file => file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt"))
      if (media.length) {
        setProgress(`Uploading ${media.length} media files as one Sarvam batch…`)
        const body = new FormData()
        media.forEach(file => body.append("files", file))
        body.append("translateTranscript", "true"); body.append("targetLanguage", "en-IN")
        const response = await fetch("/api/batch-process", { method: "POST", body })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Media processing failed.")
        items.push(...data.items)
      }
      for (let index = 0; index < pdfs.length; index++) {
        setProgress(`Digitizing PDF ${index + 1} of ${pdfs.length}…`)
        const body = new FormData(); body.append("file", pdfs[index]); body.append("language", "en-IN")
        const response = await fetch("/api/document-process", { method: "POST", body })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "PDF processing failed.")
        items.push(data)
      }
      for (let index = 0; index < texts.length; index++) {
        setProgress(`Analyzing TXT ${index + 1} of ${texts.length}…`)
        const body = new FormData(); body.append("file", texts[index])
        const response = await fetch("/api/case-analyze", { method: "POST", body })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "TXT analysis failed.")
        items.push({ fileName: texts[index].name, mediaType: "text/plain", transcript: await texts[index].text() })
      }
      if (!items.length) throw new Error("Choose PDF, TXT, audio, or video files.")
      setProgress("Creating a grounded summary…")
      const summaryResponse = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) })
      const summary = await summaryResponse.json()
      if (!summaryResponse.ok) throw new Error(summary.error || "Summarization failed.")
      setProgress("Saving to the knowledge base…")
      const saveResponse = await fetch("/api/knowledge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: files.length === 1 ? files[0].name : `${files.length} evidence files`, summary: summary.summary, items }),
      })
      const saved = await saveResponse.json()
      if (!saveResponse.ok) throw new Error(saved.error || "Save failed.")
      await refresh()
      setShowUpload(false); setSection("Overview")
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Processing failed.") }
    finally { setProcessing(false); setProgress("") }
  }

  async function ask() {
    if (!question.trim()) return
    setAsking(true); setAnswer(""); setError("")
    try {
      const response = await fetch("/api/knowledge-query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Question failed.")
      setAnswer(data.answer)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Question failed.") }
    finally { setAsking(false) }
  }

  const nav = [
    ["Overview", BookOpen], ["Evidence", FolderOpen], ["Timeline", Clock3],
    ["Contradictions", AlertTriangle], ["Ask CaseLens", Bot], ["Case brief", FileText],
  ]

  return <main className="min-h-screen bg-[#f5f5f2] text-[#20231f]">
    <header className="flex h-16 items-center justify-between border-b border-black/10 bg-white px-6">
      <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-[#183f31] font-serif font-bold text-white">C</div><span className="font-serif text-xl font-semibold">CaseLens</span></div>
      <div className="flex items-center gap-2 rounded-full bg-[#eef3ef] px-3 py-1.5 text-xs text-[#356d56]"><Languages size={14} /> Powered by Sarvam</div>
    </header>
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-[220px_1fr]">
      <aside className="border-r border-black/8 bg-white p-4">
        <nav className="space-y-1">{nav.map(([label, Icon]) => <button key={label} onClick={() => setSection(label)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${section === label ? "bg-[#eaf2ed] font-semibold text-[#285c47]" : "text-[#687069] hover:bg-black/4"}`}><Icon size={16} />{label}</button>)}</nav>
        <button onClick={() => setShowUpload(true)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#183f31] px-3 py-2.5 text-sm font-semibold text-white"><Upload size={15} /> Add evidence</button>
        <div className="mt-6 border-t pt-4 text-xs leading-6 text-[#7d847e]"><p>{store.items.length} actual sources</p><p>{events.length} extracted events</p><p>{contradictions.length} possible conflicts</p></div>
      </aside>
      <section className="min-w-0 p-7">
        {section === "Overview" && <Overview collections={store.collections} items={store.items} cases={cases} onUpload={() => setShowUpload(true)} />}
        {section === "Evidence" && <Evidence items={store.items} selected={selected} onSelect={setSelected} />}
        {section === "Timeline" && <Timeline events={events} />}
        {section === "Contradictions" && <Conflicts contradictions={contradictions} gaps={missingEvidence} />}
        {section === "Ask CaseLens" && <Ask question={question} setQuestion={setQuestion} ask={ask} answer={answer} asking={asking} />}
        {section === "Case brief" && <Brief collections={store.collections} cases={cases} />}
        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </section>
    </div>
    {showUpload && <UploadModal processing={processing} progress={progress} error={error} onClose={() => !processing && setShowUpload(false)} onProcess={processEvidence} />}
  </main>
}

function PageHead({ title, text }) { return <div className="mb-6"><h1 className="font-serif text-3xl font-semibold">{title}</h1><p className="mt-1 text-sm text-[#777e78]">{text}</p></div> }
function Empty({ onUpload, text = "No actual evidence has been processed yet." }) { return <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-white text-center"><div><FolderOpen className="mx-auto mb-3 text-[#809087]" /><p className="text-sm text-[#727a73]">{text}</p>{onUpload && <button onClick={onUpload} className="mt-4 rounded-lg bg-[#183f31] px-4 py-2 text-sm font-semibold text-white">Upload evidence</button>}</div></div> }

function Overview({ collections, items, cases, onUpload }) {
  return <><PageHead title="Case workspace" text="Only processed evidence appears in this workspace." />{!items.length ? <Empty onUpload={onUpload} /> : <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><Metric value={items.length} label="Evidence sources" /><Metric value={cases.reduce((n, item) => n + item.claims.length, 0)} label="Atomic claims" /><Metric value={cases.reduce((n, item) => n + item.events.length, 0)} label="Timeline events" /></div>{collections.map(collection => <article key={collection.id} className="rounded-2xl border border-black/8 bg-white p-5"><p className="text-xs font-bold tracking-wider text-[#39745d] uppercase">Sarvam summary</p><h2 className="mt-2 font-serif text-xl font-semibold">{collection.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#59615b]">{collection.summary}</p></article>)}</div>}</>
}
function Metric({ value, label }) { return <div className="rounded-2xl border border-black/8 bg-white p-5"><b className="font-serif text-3xl">{value}</b><p className="mt-1 text-xs text-[#7d847e]">{label}</p></div> }

function Evidence({ items, selected, onSelect }) {
  return <><PageHead title="Evidence" text={`${items.length} processed sources`} />{!items.length ? <Empty /> : <div className="grid gap-5 lg:grid-cols-[1fr_420px]"><div className="space-y-2">{items.map(item => <button key={item.id} onClick={() => onSelect(item)} className="flex w-full items-center gap-3 rounded-xl border border-black/8 bg-white p-4 text-left hover:border-[#739180]">{item.mediaType.includes("video") ? <FileVideo /> : item.mediaType.includes("audio") ? <FileAudio /> : item.mediaType.includes("text") ? <MessageSquareText /> : <FileText />}<div className="min-w-0"><p className="truncate text-sm font-semibold">{item.fileName}</p><p className="mt-1 text-xs text-[#7c837d]">{item.languageCode || item.mediaType}</p></div><Check className="ml-auto text-[#39805e]" size={15} /></button>)}</div>{selected ? <article className="max-h-[70vh] overflow-auto rounded-xl border bg-white p-5"><h2 className="font-semibold">{selected.fileName}</h2>{selected.translatedText && <><p className="mt-4 text-xs font-bold text-[#39745d] uppercase">Translation</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selected.translatedText}</p></>}<p className="mt-4 text-xs font-bold text-[#39745d] uppercase">Extracted source</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selected.transcript}</p></article> : <Empty text="Select a source to inspect its actual extracted content." />}</div>}</>
}
function Timeline({ events }) { return <><PageHead title="Timeline" text={`${events.length} events extracted from analyzed TXT evidence`} />{!events.length ? <Empty text="No timeline events have been extracted. Upload a WhatsApp TXT export." /> : <div className="space-y-4">{events.map((event, index) => <article key={`${event.id}-${index}`} className="rounded-xl border bg-white p-5"><div className="text-xs font-semibold text-[#39745d]">{event.date} · {event.caseTitle}</div><h2 className="mt-2 font-semibold">{event.title}</h2><p className="mt-2 text-sm leading-6 text-[#626a63]">{event.description}</p><p className="mt-2 text-xs text-[#39745d]">{event.sourceRefs.join(" · ")}</p></article>)}</div>}</> }
function Conflicts({ contradictions, gaps }) { return <><PageHead title="Contradictions & gaps" text="Sarvam-generated review leads, not legal conclusions." />{!contradictions.length && !gaps.length ? <Empty text="No contradictions or missing evidence have been extracted." /> : <div className="grid gap-5 lg:grid-cols-2"><div className="space-y-3">{contradictions.map((item, index) => <article key={index} className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase">{item.severity} relevance</p><h2 className="mt-2 font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-6">{item.explanation}</p><p className="mt-2 text-xs">{item.claimIds.join(" · ")}</p></article>)}</div><div className="space-y-3">{gaps.map((item, index) => <article key={index} className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-bold uppercase">{item.importance} importance</p><h2 className="mt-2 font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-6">{item.reason}</p></article>)}</div></div>}</> }
function Ask({ question, setQuestion, ask, answer, asking }) { return <><PageHead title="Ask CaseLens" text="Answers use only evidence currently stored in the knowledge base." /><div className="rounded-2xl border bg-white p-5"><div className="flex gap-2"><input value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => event.key === "Enter" && ask()} placeholder="Ask about the uploaded evidence…" className="h-12 flex-1 rounded-xl border px-4 text-sm outline-none" /><button onClick={ask} disabled={asking} className="grid size-12 place-items-center rounded-xl bg-[#183f31] text-white">{asking ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}</button></div>{answer && <div className="mt-5 whitespace-pre-wrap rounded-xl bg-[#f1f5f2] p-4 text-sm leading-6">{answer}</div>}</div></> }
function Brief({ collections, cases }) { return <><PageHead title="Case brief" text="Built only from uploaded and processed evidence." />{!collections.length ? <Empty /> : <article className="rounded-2xl border bg-white p-7"><h1 className="font-serif text-2xl font-semibold">Evidence brief</h1>{collections.map(item => <section key={item.id} className="mt-6 border-t pt-5"><h2 className="font-semibold">{item.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.summary}</p></section>)}{cases.map(item => <section key={item.id} className="mt-6 border-t pt-5"><h2 className="font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-6">{item.overview}</p></section>)}</article>}</> }

function UploadModal({ processing, progress, error, onClose, onProcess }) {
  const [files, setFiles] = useState([])
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-5"><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><button onClick={onClose} disabled={processing} className="float-right"><X /></button><div className="grid size-11 place-items-center rounded-xl bg-[#e9f2ed] text-[#356d56]"><Upload /></div><h2 className="mt-4 font-serif text-2xl font-semibold">{processing ? "Processing actual evidence…" : "Add evidence"}</h2><p className="mt-2 text-sm text-[#707871]">{processing ? progress : "Upload PDF, TXT, audio and video files together."}</p>{processing ? <div className="mt-8 flex items-center gap-3 rounded-xl bg-[#f2f5f2] p-4 text-sm"><LoaderCircle className="animate-spin" />{progress}</div> : <><label className="mt-6 grid min-h-44 cursor-pointer place-items-center rounded-xl border border-dashed bg-[#fafaf8] text-center"><div><Upload className="mx-auto mb-3 text-[#39745d]" /><b className="text-sm">{files.length ? `${files.length} files selected` : "Choose evidence files"}</b><p className="mt-1 text-xs text-[#8a918b]">PDF, TXT, MP4, WebM, MP3, M4A and WAV</p></div><input type="file" multiple accept=".pdf,.txt,audio/*,video/*" className="hidden" onChange={event => setFiles(Array.from(event.target.files || []))} /></label><button onClick={() => onProcess(files)} disabled={!files.length} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#183f31] text-sm font-semibold text-white disabled:opacity-50"><Sparkles size={16} /> Process with Sarvam <ArrowRight size={15} /></button></>}{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</div></div>
}
