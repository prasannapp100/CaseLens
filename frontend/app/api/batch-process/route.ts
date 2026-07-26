import { execFile } from "node:child_process"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { extname, join } from "node:path"
import { promisify } from "node:util"

import ffmpegPath from "ffmpeg-static"
import { SarvamAIClient } from "sarvamai"

const runFile = promisify(execFile)
const SARVAM_API = "https://api.sarvam.ai"

export const runtime = "nodejs"
export const maxDuration = 1800

function safeName(name: string, index: number) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${String(index + 1).padStart(2, "0")}-${cleaned}`
}

function splitText(text: string, limit = 900) {
  const chunks: string[] = []
  let remaining = text.trim()
  while (remaining.length > limit) {
    let boundary = remaining.lastIndexOf(" ", limit)
    if (boundary < limit * 0.6) boundary = limit
    chunks.push(remaining.slice(0, boundary).trim())
    remaining = remaining.slice(boundary).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

async function translate(text: string, targetLanguage: string, key: string) {
  const translated: string[] = []
  for (const chunk of splitText(text)) {
    let completed = false
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(`${SARVAM_API}/translate`, {
        method: "POST",
        headers: { "api-subscription-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: chunk,
          source_language_code: "auto",
          target_language_code: targetLanguage,
          model: "mayura:v1",
          mode: "modern-colloquial",
        }),
      })
      const body = await response.json()
      if (response.ok) {
        translated.push(body.translated_text)
        completed = true
        break
      }
      const retryable = response.status === 429 || response.status === 503
      if (retryable && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt))
        continue
      }
      const detail = Array.isArray(body?.detail)
        ? body.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(", ")
        : body?.detail
      throw new Error(`Translation failed (${response.status}): ${detail || body?.message || "Sarvam rejected the request."}`)
    }
    if (!completed) throw new Error("Translation failed after four attempts.")
  }
  return translated.join("\n")
}
export async function POST(request: Request) {
  let workDirectory = ""
  try {
    const key = process.env.SARVAM_API_KEY
    if (!key) return Response.json({ error: "SARVAM_API_KEY is not configured." }, { status: 503 })
    const form = await request.formData()
    const files = form.getAll("files").filter((value): value is File => value instanceof File)
    const translateTranscript = form.get("translateTranscript") === "true"
    const targetLanguage = String(form.get("targetLanguage") || "en-IN")

    if (!files.length) return Response.json({ error: "Choose at least one media file." }, { status: 400 })
    if (files.length > 20) return Response.json({ error: "Sarvam batch jobs accept up to 20 files." }, { status: 400 })

    workDirectory = await mkdtemp(join(tmpdir(), "vaani-batch-"))
    const inputsDirectory = join(workDirectory, "inputs")
    const outputsDirectory = join(workDirectory, "outputs")
    await import("node:fs/promises").then(({ mkdir }) => mkdir(inputsDirectory, { recursive: true }))

    const inputPaths: string[] = []
    const originalNames = new Map<string, { name: string; type: string }>()
    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      const incomingName = safeName(file.name, index)
      const incomingPath = join(inputsDirectory, incomingName)
      await writeFile(incomingPath, Buffer.from(await file.arrayBuffer()))
      const isMp4 = file.type === "video/mp4" || extname(file.name).toLowerCase() === ".mp4"
      if (isMp4) {
        if (!ffmpegPath) throw new Error("FFmpeg is unavailable on this server.")
        const mp3Name = incomingName.replace(/\.mp4$/i, ".mp3")
        const mp3Path = join(inputsDirectory, mp3Name)
        await runFile(ffmpegPath, ["-y", "-i", incomingPath, "-vn", "-map", "0:a:0", "-codec:a", "libmp3lame", "-b:a", "192k", mp3Path])
        inputPaths.push(mp3Path)
        originalNames.set(mp3Name, { name: file.name, type: file.type })
      } else {
        inputPaths.push(incomingPath)
        originalNames.set(incomingName, { name: file.name, type: file.type })
      }
    }

    const client = new SarvamAIClient({ apiSubscriptionKey: key })
    const job = await client.speechToTextJob.createJob({
      model: "saaras:v3",
      mode: "transcribe",
      withTimestamps: true,
    })
    await job.uploadFiles(inputPaths, 600)
    await job.start()
    const status = await job.waitUntilComplete(5, 1800)
    if (status.job_state.toLowerCase() === "failed") {
      throw new Error(status.error_message || `Sarvam batch job ${job.jobId} failed.`)
    }
    await job.downloadOutputs(outputsDirectory)

    const outputFiles = await readdir(outputsDirectory)
    const items = []
    for (const outputName of outputFiles) {
      const uploadedName = outputName.replace(/\.json$/, "")
      const original = originalNames.get(uploadedName) || { name: uploadedName, type: "audio/mpeg" }
      const result = JSON.parse(await readFile(join(outputsDirectory, outputName), "utf8"))
      const transcript = String(result.transcript || "")
      items.push({
        fileName: original.name,
        mediaType: original.type,
        transcript,
        languageCode: result.language_code,
        translatedText: translateTranscript ? await translate(transcript, targetLanguage, key) : undefined,
      })
    }

    return Response.json({
      jobId: job.jobId,
      items,
      failedFiles: status.failed_files_count,
      successfulFiles: status.successful_files_count,
    })
  } catch (caught) {
    console.log(caught)
    return Response.json({ error: caught instanceof Error ? caught.message : "Batch processing failed." }, { status: 500 })
  } finally {
    if (workDirectory) await rm(workDirectory, { recursive: true, force: true })
  }
}
