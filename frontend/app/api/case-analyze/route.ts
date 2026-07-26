import { listCases, saveCase } from "@/lib/case-store"

const SARVAM_API = "https://api.sarvam.ai"

export const runtime = "nodejs"
export const maxDuration = 300

function parseJson(content: string) {
  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/, "")
  return JSON.parse(cleaned)
}

export async function GET() {
  const cases = await listCases()
  return Response.json({
    cases: cases.map((item) => ({
      id: item.id,
      title: item.title,
      overview: item.overview,
      entities: item.entities,
      claims: item.claims,
      events: item.events,
      contradictions: item.contradictions,
      missingEvidence: item.missingEvidence,
      createdAt: item.createdAt,
    })),
  })
}

export async function POST(request: Request) {
  try {
    const key = process.env.SARVAM_API_KEY
    if (!key) return Response.json({ error: "SARVAM_API_KEY is not configured." }, { status: 503 })
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return Response.json({ error: "Upload a WhatsApp TXT export." }, { status: 400 })
    const sourceText = await file.text()
    if (!sourceText.trim()) return Response.json({ error: "The uploaded TXT file is empty." }, { status: 400 })
    if (sourceText.length > 180000) return Response.json({ error: "This first version supports TXT exports up to 180,000 characters." }, { status: 413 })

    const response = await fetch(`${SARVAM_API}/v1/chat/completions`, {
      method: "POST",
      headers: { "api-subscription-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sarvam-105b",
        reasoning_effort: "medium",
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are CaseLens, an evidence analysis engine for lawyers. Analyze evidence coverage, never decide legal truth. Return valid JSON only with this exact shape:
{"overview":"string","entities":[{"id":"P-01","name":"string","type":"person|organization|place|other","aliases":["string"]}],"claims":[{"id":"C-01","claim":"one atomic factual assertion","claimType":"payment_commitment|payment_claim|meeting|agreement|threat|delivery|identity|other","speaker":"string","counterparty":"string","eventDate":"ISO date or unknown","sourceRef":"exact WhatsApp line/message reference","confidence":0.0}],"events":[{"id":"E-01","title":"string","date":"ISO date or unknown","description":"string","claimIds":["C-01"],"sourceRefs":["exact reference"]}],"contradictions":[{"title":"string","explanation":"why directly comparable claims may conflict","claimIds":["C-01","C-02"],"severity":"low|medium|high"}],"missingEvidence":[{"title":"string","reason":"what is mentioned but absent and why it matters","mentionedIn":["source reference"],"importance":"low|medium|high"}]}.
Resolve aliases conservatively. Keep every claim atomic. Cluster claims that describe the same real-world event. Only flag genuine comparable conflicts. Every claim and event must preserve exact provenance.`,
          },
          { role: "user", content: `Analyze this WhatsApp export named "${file.name}":\n\n${sourceText}` },
        ],
      }),
    })
    const body = await response.json()
    if (!response.ok) {
      const detail = Array.isArray(body?.detail) ? body.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(", ") : body?.detail
      throw new Error(detail || body?.message || `Sarvam analysis failed (${response.status}).`)
    }
    const content = body?.choices?.[0]?.message?.content
    if (!content) throw new Error("Sarvam returned an empty case analysis.")
    const analysis = parseJson(content)
    const saved = await saveCase({ title: file.name, sourceText, ...analysis })
    return Response.json(saved)
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : "Case analysis failed." }, { status: 500 })
  }
}
