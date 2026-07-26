import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export type CaseAnalysis = {
  id: string
  title: string
  sourceText: string
  overview: string
  entities: Array<{ id: string; name: string; type: string; aliases: string[] }>
  claims: Array<{
    id: string
    claim: string
    claimType: string
    speaker: string
    counterparty: string
    eventDate: string
    sourceRef: string
    confidence: number
  }>
  events: Array<{ id: string; title: string; date: string; description: string; claimIds: string[]; sourceRefs: string[] }>
  contradictions: Array<{ title: string; explanation: string; claimIds: string[]; severity: string }>
  missingEvidence: Array<{ title: string; reason: string; mentionedIn: string[]; importance: string }>
  createdAt: string
}

const storePath = join(process.cwd(), "data", "case-analyses.json")
let queue = Promise.resolve()

export async function listCases() {
  try {
    return JSON.parse(await readFile(storePath, "utf8")) as CaseAnalysis[]
  } catch {
    return []
  }
}

export async function saveCase(analysis: Omit<CaseAnalysis, "id" | "createdAt">) {
  const operation = queue.then(async () => {
    const cases = await listCases()
    const saved = { ...analysis, id: randomUUID(), createdAt: new Date().toISOString() }
    cases.unshift(saved)
    await mkdir(dirname(storePath), { recursive: true })
    const temporary = `${storePath}.tmp`
    await writeFile(temporary, JSON.stringify(cases, null, 2))
    await rename(temporary, storePath)
    return saved
  })
  queue = operation.then(() => undefined, () => undefined)
  return operation
}
