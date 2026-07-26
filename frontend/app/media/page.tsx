"use client"

import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Download,
  FileAudio,
  FileVideo,
  Globe2,
  LoaderCircle,
  Layers3,
  Mic2,
  Play,
  Sparkles,
  Upload,
  X,
} from "lucide-react"
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react"
import Link from "next/link"

const languages = [
  ["hi-IN", "Hindi"], ["bn-IN", "Bengali"], ["ta-IN", "Tamil"],
  ["te-IN", "Telugu"], ["kn-IN", "Kannada"], ["ml-IN", "Malayalam"],
  ["mr-IN", "Marathi"], ["gu-IN", "Gujarati"], ["pa-IN", "Punjabi"],
  ["od-IN", "Odia"], ["en-IN", "English (India)"],
]

const voices = [
  ["shubh", "Shubh · Warm"], ["priya", "Priya · Clear"],
  ["ishita", "Ishita · Natural"], ["ratan", "Ratan · Rich"],
  ["ritu", "Ritu · Bright"], ["roopa", "Roopa · Expressive"],
]

type Result = {
  transcript: string
  translatedText?: string
  languageCode?: string
  audio?: string
  extractedAudio?: string
  requestId?: string
  summary?: string
}

type KnowledgeCollection = { id: string; title: string; summary: string; itemIds: string[]; createdAt: string }

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Page() {
  const [files, setFiles] = useState<File[]>([])
  const file = files[0] || null
  const [preview, setPreview] = useState("")
  const [mode, setMode] = useState<"dub" | "transcribe">("dub")
  const [language, setLanguage] = useState("hi-IN")
  const [voice, setVoice] = useState("shubh")
  const [translateTranscript, setTranslateTranscript] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState("")
  const [collections, setCollections] = useState<KnowledgeCollection[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  useEffect(() => {
    fetch("/api/knowledge")
      .then((response) => response.json())
      .then((data) => setCollections(data.collections || []))
      .catch(() => undefined)
  }, [])

  function chooseFiles(next: File[]) {
    if (!next.length) return
    if (next.some((item) => !item.type.startsWith("audio/") && !item.type.startsWith("video/"))) {
      setError("Please choose an audio or video file.")
      return
    }
    setFiles(next)
    setPreview(URL.createObjectURL(next[0]))
    setResult(null)
    setError("")
  }

  async function processMedia() {
    if (!file) return inputRef.current?.click()
    setLoading(true)
    setError("")
    setResult(null)
    try {
      setProgress(`Uploading ${files.length} files as one Sarvam batch…`)
      const batchBody = new FormData()
      files.forEach((current) => batchBody.append("files", current))
      batchBody.append("targetLanguage", language)
      batchBody.append("translateTranscript", String(mode === "dub" || translateTranscript))
      const batchResponse = await fetch("/api/batch-process", { method: "POST", body: batchBody })
      const batchData = await batchResponse.json()
      if (!batchResponse.ok) throw new Error(batchData.error || "Sarvam batch processing failed.")
      const processed = batchData.items as Array<Result & { fileName: string; mediaType: string }>
      if (!processed.length) throw new Error("The batch completed without any successful transcripts.")

      setProgress("Creating a combined summary…")
      const summaryResponse = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: processed.map(({ fileName, transcript, translatedText }) => ({
            fileName,
            transcript,
            translatedText,
          })),
        }),
      })
      const summaryData = await summaryResponse.json()
      if (!summaryResponse.ok) throw new Error(summaryData.error || "Summarization failed.")

      setProgress("Saving to your knowledge base…")
      const saveResponse = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: files.length === 1 ? files[0].name : `${files.length} media files`,
          summary: summaryData.summary,
          targetLanguage: mode === "dub" || translateTranscript ? language : undefined,
          items: processed.map((item) => ({
            fileName: item.fileName,
            mediaType: item.mediaType,
            transcript: item.transcript,
            translatedText: item.translatedText,
            languageCode: item.languageCode,
          })),
        }),
      })
      const saved = await saveResponse.json()
      if (!saveResponse.ok) throw new Error(saved.error || "Could not save the knowledge base.")
      setCollections((current) => [saved.collection, ...current])
      setResult({
        transcript: processed.map((item) => `${item.fileName}\n${item.transcript}`).join("\n\n"),
        translatedText: processed.some((item) => item.translatedText)
          ? processed.map((item) => `${item.fileName}\n${item.translatedText || item.transcript}`).join("\n\n")
          : undefined,
        summary: summaryData.summary,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to process this file.")
    } finally {
      setLoading(false)
      setProgress("")
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#1c1d1a]">
      <header className="border-b border-black/8 bg-[#fbfbf8]">
        <div className="mx-auto flex h-18 max-w-[1180px] items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-[#183f31] text-white shadow-sm">
              <Mic2 size={18} strokeWidth={2.4} />
            </div>
            <span className="font-serif text-[21px] font-semibold tracking-[-.02em]">caselends Studio</span>
            <span className="hidden rounded-full border border-[#d8dbd2] bg-white px-2.5 py-1 text-[10px] font-semibold tracking-[.12em] text-[#637067] uppercase sm:block">Powered by Sarvam</span>
          </div>
          <div className="flex items-center gap-2"><Link href="/main" className="rounded-lg border border-[#d8dbd2] px-4 py-2 text-xs font-semibold">Case workspace</Link><Link href="/cases" className="rounded-lg bg-[#183f31] px-4 py-2 text-xs font-semibold text-white">WhatsApp intelligence</Link></div>
        </div>
      </header>

      <section className="mx-auto max-w-[1180px] px-5 pt-15 pb-20">
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_370px]">
          <div className="overflow-hidden rounded-[22px] border border-black/9 bg-white shadow-[0_12px_45px_rgba(38,50,42,.06)]">
            <div className="border-b border-black/7 px-6 pt-6">
              <div className="flex gap-7">
                <button onClick={() => { setMode("dub"); setResult(null) }} className={`relative flex items-center gap-2 pb-5 text-sm font-semibold ${mode === "dub" ? "text-[#1e5b43]" : "text-[#89908a]"}`}>
                  <Globe2 size={17} /> Dub media
                  {mode === "dub" && <span className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-[#2f7257]" />}
                </button>
                <button onClick={() => { setMode("transcribe"); setResult(null) }} className={`relative flex items-center gap-2 pb-5 text-sm font-semibold ${mode === "transcribe" ? "text-[#1e5b43]" : "text-[#89908a]"}`}>
                  <FileAudio size={17} /> Transcribe
                  {mode === "transcribe" && <span className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-[#2f7257]" />}
                </button>
              </div>
            </div>

            <div className="p-6">
              {!file ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e: DragEvent) => { e.preventDefault(); setDragging(false); chooseFiles(Array.from(e.dataTransfer.files)) }}
                  onClick={() => inputRef.current?.click()}
                  className={`group grid min-h-[265px] cursor-pointer place-items-center rounded-2xl border border-dashed transition ${dragging ? "border-[#2f7257] bg-[#f0f7f3]" : "border-[#cdd2cb] bg-[#fafaf8] hover:border-[#66927f] hover:bg-[#f7faf8]"}`}
                >
                  <div className="text-center">
                    <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border border-[#dce1da] bg-white text-[#356d56] shadow-sm transition group-hover:-translate-y-0.5">
                      <Upload size={23} />
                    </div>
                    <p className="text-[15px] font-semibold">Drop your audio and video files here</p>
                    <p className="mt-2 text-sm text-[#858b85]">or <span className="font-medium text-[#356d56] underline underline-offset-4">browse from your device</span></p>
                    <p className="mt-5 text-[11px] tracking-wide text-[#a1a6a0] uppercase">Multiple MP3, WAV, M4A, MP4 or WebM files</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#dfe2dc] bg-[#fafaf8] p-4">
                  <div className="flex items-center gap-4">
                    <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#e8f1ec] text-[#356d56]">
                      {file.type.startsWith("video/") ? <FileVideo size={22} /> : <FileAudio size={22} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{file.name}</p>
                      <p className="mt-1 text-xs text-[#858b85]">{formatBytes(file.size)} · Ready to process</p>
                    </div>
                    <button onClick={() => { setFiles([]); setPreview(""); setResult(null) }} className="grid size-8 place-items-center rounded-full text-[#7c847e] hover:bg-black/5" aria-label="Remove files"><X size={16} /></button>
                  </div>
                  {files.length > 1 && <div className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#59635c]"><Layers3 size={14} className="text-[#356d56]" /> {files.length} files queued · {formatBytes(files.reduce((total, item) => total + item.size, 0))} total</div>}
                  {preview && (file.type.startsWith("video/")
                    ? <video className="mt-4 max-h-64 w-full rounded-xl bg-black" controls src={preview} />
                    : <audio className="mt-4 w-full" controls src={preview} />)}
                </div>
              )}
              <input ref={inputRef} type="file" accept="audio/*,video/*" multiple className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => chooseFiles(Array.from(e.target.files || []))} />

              {(mode === "dub" || translateTranscript) && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-xs font-semibold text-[#505751]">{mode === "dub" ? "Dub into" : "Translate into"}</span>
                    <div className="relative">
                      <select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-12 w-full appearance-none rounded-xl border border-[#d8dcd6] bg-white px-4 text-sm font-medium outline-none focus:border-[#4f806b]">
                        {languages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                      </select><ChevronDown className="pointer-events-none absolute top-4 right-4 text-[#7e857e]" size={16} />
                    </div>
                  </label>
                  {mode === "dub" && <label>
                    <span className="mb-2 block text-xs font-semibold text-[#505751]">Voice</span>
                    <div className="relative">
                      <select value={voice} onChange={(e) => setVoice(e.target.value)} className="h-12 w-full appearance-none rounded-xl border border-[#d8dcd6] bg-white px-4 text-sm font-medium outline-none focus:border-[#4f806b]">
                        {voices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                      </select><ChevronDown className="pointer-events-none absolute top-4 right-4 text-[#7e857e]" size={16} />
                    </div>
                  </label>}
                </div>
              )}

              {mode === "transcribe" && (
                <label className="mt-5 flex cursor-pointer items-center justify-between rounded-xl border border-[#d8dcd6] bg-[#fafaf8] px-4 py-3.5">
                  <span>
                    <span className="block text-sm font-semibold">Translate transcript</span>
                    <span className="mt-0.5 block text-xs text-[#858b85]">Also return the transcript in another language</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={translateTranscript}
                    onClick={() => { setTranslateTranscript((value) => !value); setResult(null) }}
                    className={`relative h-6 w-11 rounded-full transition ${translateTranscript ? "bg-[#286048]" : "bg-[#cbd0ca]"}`}
                  >
                    <span className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition-all ${translateTranscript ? "left-6" : "left-1"}`} />
                  </button>
                </label>
              )}

              {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <button onClick={processMedia} disabled={loading} className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#183f31] text-sm font-semibold text-white shadow-sm transition hover:bg-[#24533f] disabled:cursor-wait disabled:opacity-70">
                {loading ? <><LoaderCircle className="animate-spin" size={17} /> {progress || "Processing your media…"}</> : <>{mode === "dub" ? <Globe2 size={17} /> : <FileAudio size={17} />} {file ? (mode === "dub" ? `Process & save ${files.length} file${files.length > 1 ? "s" : ""}` : `Transcribe & save ${files.length} file${files.length > 1 ? "s" : ""}`) : "Choose files"} <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>

          <aside className="space-y-5">
            {result ? (
              <div className="rounded-[22px] border border-[#cbdcd3] bg-[#f1f7f3] p-5 shadow-[0_12px_35px_rgba(38,70,53,.07)]">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#286048]"><span className="grid size-6 place-items-center rounded-full bg-[#d5e9dd]"><Check size={14} /></span> Ready</div>
                {result.summary && <div className="mb-5 rounded-xl border border-[#d2dfd7] bg-white p-4"><p className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.14em] text-[#4d715f] uppercase"><Sparkles size={13} /> Combined summary</p><p className="whitespace-pre-wrap text-sm leading-6 text-[#39453e]">{result.summary}</p></div>}
                {result.audio && <>
                  <audio className="w-full" controls src={result.audio} />
                  <a href={result.audio} download={`caselends-${language}.wav`} className="mt-3 flex h-10 items-center justify-center gap-2 rounded-lg border border-[#bcd1c5] bg-white text-xs font-semibold text-[#285c47] hover:bg-[#f8fbf9]"><Download size={14} /> Download dubbed audio</a>
                </>}
                {result.extractedAudio && !result.audio && <>
                  <audio className="w-full" controls src={result.extractedAudio} />
                  <a href={result.extractedAudio} download="extracted-audio.mp3" className="mt-3 flex h-10 items-center justify-center gap-2 rounded-lg border border-[#bcd1c5] bg-white text-xs font-semibold text-[#285c47] hover:bg-[#f8fbf9]"><Download size={14} /> Download extracted MP3</a>
                </>}
                <p className="mt-5 mb-2 text-[10px] font-bold tracking-[.14em] text-[#718077] uppercase">{result.translatedText ? "Translated script" : "Transcript"}</p>
                <p className="max-h-56 overflow-auto text-sm leading-6 text-[#39453e]">{result.translatedText || result.transcript}</p>
                {result.translatedText && <details className="mt-4 border-t border-[#d2dfd7] pt-3 text-xs text-[#65736b]"><summary className="cursor-pointer font-semibold">Original transcript</summary><p className="mt-2 leading-5">{result.transcript}</p></details>}
              </div>
            ) : (
              <div className="rounded-[22px] border border-black/8 bg-[#ecefe9] p-6">
                <p className="font-serif text-xl font-semibold">One upload. Two superpowers.</p>
                <div className="mt-6 space-y-5">
                  <Feature icon={<Globe2 size={17} />} title="Natural dubbing" text="Translate speech and generate expressive audio with Bulbul v3 voices." />
                  <Feature icon={<FileAudio size={17} />} title="Accurate transcripts" text="Turn spoken Indian languages and English into clean, editable text." />
                  <Feature icon={<Play size={17} />} title="Instant preview" text="Listen to the new voice before downloading your dub track." />
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-black/7 bg-white p-5">
              <div className="flex items-center justify-between text-xs"><span className="font-semibold">Sarvam models</span><span className="flex items-center gap-1 text-[#4d7b66]"><span className="size-1.5 rounded-full bg-[#41a274]" /> Live</span></div>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold tracking-wide text-[#687069] uppercase">
                <span className="rounded-md bg-[#f1f3ef] px-2 py-1.5">Saaras v3</span><span className="rounded-md bg-[#f1f3ef] px-2 py-1.5">Sarvam Translate</span><span className="rounded-md bg-[#f1f3ef] px-2 py-1.5">Bulbul v3</span>
              </div>
            </div>
            <div className="rounded-2xl border border-black/7 bg-white p-5">
              <div className="mb-4 flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-semibold"><BookOpen size={16} className="text-[#356d56]" /> Knowledge base</span><span className="text-xs text-[#858b85]">{collections.length} saved</span></div>
              {collections.length ? <div className="space-y-3">{collections.slice(0, 4).map((collection) => <div key={collection.id} className="rounded-xl bg-[#f5f6f3] p-3"><p className="truncate text-xs font-semibold">{collection.title}</p><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#747b75]">{collection.summary}</p><p className="mt-2 text-[10px] text-[#949a94]">{collection.itemIds.length} source{collection.itemIds.length === 1 ? "" : "s"}</p></div>)}</div> : <p className="text-xs leading-5 text-[#858b85]">Processed media and summaries will appear here automatically.</p>}
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="flex gap-3.5"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[#356d56] shadow-sm">{icon}</div><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-[#747b75]">{text}</p></div></div>
}
