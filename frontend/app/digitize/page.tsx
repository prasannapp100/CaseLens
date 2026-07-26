"use client"

import { AlertTriangle, ArrowRight, Check, FileAudio, FileImage, FileText, FileVideo, LoaderCircle, Network, Upload, X } from "lucide-react"
import Link from "next/link"
import { ChangeEvent, DragEvent, useState } from "react"

type Source = {
  fileName: string
  mediaType: string
  transcript: string
  translatedText?: string
  languageCode?: string
  segments?: Array<{ text: string; start: number; end: number; speaker?: string }>
}
type Notice = { fileName: string; stage: string; message: string }

const acceptedExtensions = ["pdf", "png", "jpg", "jpeg", "zip", "txt"]
const extension = (file: File) => file.name.toLowerCase().split(".").pop() || ""
const isMedia = (file: File) => file.type.startsWith("audio/") || file.type.startsWith("video/")
const isAccepted = (file: File) => isMedia(file) || acceptedExtensions.includes(extension(file))
const size = (bytes: number) => bytes < 1048576 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`
const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`

function SourceIcon({ file }: { file: File }) {
  if (file.type.startsWith("video/")) return <FileVideo />
  if (file.type.startsWith("audio/")) return <FileAudio />
  if (["png", "jpg", "jpeg"].includes(extension(file))) return <FileImage />
  return <FileText />
}

export default function DigitizePage() {
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState("")
  const [notices, setNotices] = useState<Notice[]>([])
  const [completed, setCompleted] = useState<Source[]>([])
  const [summary, setSummary] = useState("")

  function addFiles(incoming: File[]) {
    const supported = incoming.filter(isAccepted)
    setFiles((current) => [...current, ...supported.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size))])
    const rejected = incoming.filter((file) => !isAccepted(file))
    if (rejected.length) setNotices(rejected.map((file) => ({ fileName: file.name, stage: "Format", message: "This format is not accepted by the configured Sarvam pipeline." })))
  }

  async function run() {
    if (!files.length) return
    setWorking(true)
    setCompleted([])
    setSummary("")
    const warnings: Notice[] = []
    const sources: Source[] = []
    const media = files.filter(isMedia)
    const documents = files.filter((file) => ["pdf", "png", "jpg", "jpeg", "zip"].includes(extension(file)))
    const text = files.filter((file) => extension(file) === "txt")

    if (media.length) {
      setProgress(`Digitizing speech from ${media.length} media files…`)
      const form = new FormData()
      media.forEach((file) => form.append("files", file))
      form.append("translateTranscript", "true")
      form.append("targetLanguage", "en-IN")
      try {
        const response = await fetch("/api/batch-process", { method: "POST", body: form })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Sarvam speech digitization failed.")
        sources.push(...(body.items || []))
      } catch (caught) {
        media.forEach((file) => warnings.push({ fileName: file.name, stage: "Speech digitization", message: caught instanceof Error ? caught.message : "Processing failed." }))
      }
    }

    for (let index = 0; index < documents.length; index++) {
      const file = documents[index]
      setProgress(`Scanning ${file.name} · ${index + 1} of ${documents.length}…`)
      try {
        const form = new FormData()
        form.append("file", file)
        form.append("language", "en-IN")
        const response = await fetch("/api/document-process", { method: "POST", body: form })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Sarvam document digitization failed.")
        sources.push(body)
      } catch (caught) {
        warnings.push({ fileName: file.name, stage: "Document digitization", message: caught instanceof Error ? caught.message : "Processing failed." })
      }
    }

    for (const file of text) {
      setProgress(`Reading ${file.name}…`)
      const transcript = await file.text()
      if (transcript.trim()) sources.push({ fileName: file.name, mediaType: "text/plain", transcript })
      else warnings.push({ fileName: file.name, stage: "Text extraction", message: "The file was empty." })
    }

    if (sources.length) {
      const evidence = sources.map((source) => {
        const content = source.segments?.length
          ? source.segments.map((segment) => `[${clock(segment.start)}-${clock(segment.end)}] ${segment.text}`).join("\n")
          : source.translatedText || source.transcript
        return `[SOURCE FILE: ${source.fileName}]\n${content}`
      }).join("\n\n").slice(0, 175000)

      setProgress("Adding successful sources to the knowledge graph…")
      const graph = new FormData()
      graph.append("file", new File([evidence], `digitized-sources-${Date.now()}.txt`, { type: "text/plain" }))
      const graphResponse = await fetch("/api/case-analyze", { method: "POST", body: graph })
      const graphBody = await graphResponse.json()
      if (!graphResponse.ok) warnings.push({ fileName: "Combined sources", stage: "Knowledge graph", message: graphBody.error || "Graph analysis failed." })

      setProgress("Creating summary and saving sources…")
      const summaryResponse = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: sources }) })
      const summaryBody = await summaryResponse.json()
      const generatedSummary = summaryResponse.ok ? summaryBody.summary : `${sources.length} sources digitized successfully.`
      if (!summaryResponse.ok) warnings.push({ fileName: "Combined sources", stage: "Summary", message: summaryBody.error || "Summary failed." })
      const saveResponse = await fetch("/api/knowledge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `${sources.length} digitized sources`, summary: generatedSummary, targetLanguage: "en-IN", items: sources }),
      })
      const saveBody = await saveResponse.json()
      if (!saveResponse.ok) warnings.push({ fileName: "Combined sources", stage: "Knowledge base", message: saveBody.error || "Saving failed." })
      setSummary(generatedSummary)
    }

    setCompleted(sources)
    setNotices(warnings)
    setProgress("")
    setWorking(false)
  }

  return <main className="min-h-screen bg-[#f4f4ef] text-[#18201c]">
    <header className="border-b border-black/8 bg-[#fafaf7]"><div className="mx-auto flex h-18 max-w-[1200px] items-center justify-between px-6"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#183f31] text-white"><Network size={18} /></span><div><p className="font-serif text-xl font-semibold">Source digitizer</p><p className="text-[10px] tracking-[.14em] text-[#737c76] uppercase">Powered by Sarvam</p></div></div><div className="flex gap-2"><Link href="/media" className="rounded-lg border px-4 py-2 text-xs font-semibold">Media studio</Link><Link href="/main" className="rounded-lg bg-[#183f31] px-4 py-2 text-xs font-semibold text-white">Case workspace</Link></div></div></header>
    <section className="mx-auto max-w-[1200px] px-6 py-12">
      <p className="text-xs font-bold tracking-[.16em] text-[#8b5139] uppercase">All-source intake</p><h1 className="mt-3 max-w-3xl font-serif text-4xl">Digitize every accepted source into cited case knowledge.</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[#68716b]">Upload mixed batches of audio, video, PDFs, scanned images, ZIP document batches, and text. Each source is processed independently so one rejection never stops the queue.</p>
      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[1fr_370px]">
        <div className="rounded-[22px] border border-black/9 bg-white p-6 shadow-sm">
          <label onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event: DragEvent) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)) }} className={`grid min-h-56 cursor-pointer place-items-center rounded-2xl border border-dashed ${dragging ? "border-[#347458] bg-[#eff7f2]" : "border-[#cbd1ca] bg-[#fafaf8]"}`}><div className="text-center"><Upload className="mx-auto mb-4 text-[#347458]" /><p className="font-semibold">Drop all source files here</p><p className="mt-2 text-xs text-[#818883]">Audio · video · PDF · PNG · JPG · ZIP · TXT</p></div><input type="file" multiple accept="audio/*,video/*,.pdf,.png,.jpg,.jpeg,.zip,.txt" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => addFiles(Array.from(event.target.files || []))} /></label>
          <div className="mt-5 space-y-2">{files.map((file, index) => <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-xl border bg-[#fafaf8] p-3"><span className="text-[#347458]"><SourceIcon file={file} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.name}</p><p className="text-[11px] text-[#858c86]">{size(file.size)}</p></div><button onClick={() => setFiles((current) => current.filter((_, item) => item !== index))}><X size={16} /></button></div>)}</div>
          <button onClick={run} disabled={!files.length || working} className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#183f31] text-sm font-semibold text-white disabled:opacity-50">{working ? <><LoaderCircle className="animate-spin" size={17} />{progress}</> : <><Network size={17} />Digitize and add to knowledge graph<ArrowRight size={16} /></>}</button>
        </div>
        <aside className="space-y-4">
          {completed.length > 0 && <div className="rounded-[22px] border border-[#c8dcd1] bg-[#eff7f2] p-5"><p className="flex items-center gap-2 text-sm font-semibold text-[#276047]"><Check size={17} />{completed.length} sources saved</p>{summary && <p className="mt-3 text-xs leading-5 text-[#58655e]">{summary}</p>}<Link href="/main" className="mt-4 block rounded-lg bg-[#183f31] px-4 py-2.5 text-center text-xs font-semibold text-white">Open knowledge graph</Link></div>}
          {notices.length > 0 && <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-5"><p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><AlertTriangle size={16} />Processing stack</p><p className="mt-1 text-xs text-amber-800">Rejected items were skipped; the remaining queue continued.</p><div className="mt-4 max-h-80 space-y-2 overflow-auto">{notices.map((notice, index) => <div key={index} className="rounded-xl bg-white p-3"><p className="truncate text-xs font-semibold">{notice.fileName}</p><p className="mt-1 text-[10px] font-bold text-amber-800 uppercase">{notice.stage}</p><p className="mt-1 text-[11px] leading-4 text-[#707872]">{notice.message}</p></div>)}</div></div>}
          {!completed.length && !notices.length && <div className="rounded-[22px] border bg-white p-5"><p className="font-serif text-xl">Independent processing queue</p><p className="mt-3 text-xs leading-5 text-[#747c76]">Documents use Sarvam Document Intelligence. Audio and video use Saaras speech recognition. Successful results retain filenames and timestamps for future source references.</p></div>}
        </aside>
      </div>
    </section>
  </main>
}
