import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import AdmZip from "adm-zip"
import { SarvamAIClient } from "sarvamai"

export const runtime = "nodejs"
export const maxDuration = 600

export async function POST(request: Request) {
  let workDirectory = ""
  try {
    const key = process.env.SARVAM_API_KEY
    if (!key) return Response.json({ error: "SARVAM_API_KEY is not configured." }, { status: 503 })
    const form = await request.formData()
    const file = form.get("file")
    const language = String(form.get("language") || "en-IN")
    const extension = file instanceof File ? file.name.toLowerCase().split(".").pop() : ""
    if (!(file instanceof File) || !["pdf", "png", "jpg", "jpeg", "zip"].includes(extension || "")) {
      return Response.json({ error: "Upload a PDF, PNG, JPG, JPEG, or ZIP document." }, { status: 400 })
    }
    if (file.size > 200 * 1024 * 1024) return Response.json({ error: "Documents must be under 200 MB." }, { status: 413 })

    workDirectory = await mkdtemp(join(tmpdir(), "caselens-doc-"))
    const inputPath = join(workDirectory, file.name.replace(/[^a-zA-Z0-9._-]/g, "_"))
    const outputPath = join(workDirectory, "output.zip")
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()))

    const client = new SarvamAIClient({ apiSubscriptionKey: key })
    const job = await client.documentIntelligence.createJob({
      language: language as "en-IN",
      outputFormat: "md",
      pollingIntervalMs: 2000,
      maxPollingAttempts: 300,
    })
    await job.uploadFile(inputPath)
    await job.start()
    const status = await job.waitUntilComplete()
    if (status.job_state === "Failed") throw new Error(status.error_message || "Sarvam could not digitize this document.")
    await job.downloadOutput(outputPath)

    const archive = new AdmZip(outputPath)
    const entries = archive.getEntries()
    const markdown = entries
      .filter((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".md"))
      .map((entry) => entry.getData().toString("utf8"))
      .join("\n\n")
    const jsonText = entries
      .filter((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".json"))
      .map((entry) => entry.getData().toString("utf8"))
      .join("\n")
    const text = markdown || jsonText
    if (!text.trim()) throw new Error("Sarvam completed the job but returned no extractable text.")

    return Response.json({
      fileName: file.name,
      mediaType: file.type || `application/${extension}`,
      transcript: text,
      languageCode: language,
      jobId: job.jobId,
      pages: job.getPageMetrics(),
    })
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : "Document processing failed." }, { status: 500 })
  } finally {
    if (workDirectory) await rm(workDirectory, { recursive: true, force: true })
  }
}
