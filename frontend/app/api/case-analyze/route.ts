import { listCases, saveCase } from "@/lib/case-store"

const SARVAM_API = "https://api.sarvam.ai"

export const runtime = "nodejs"
export const maxDuration = 300

function parseJson(content: string) {
  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/, "")
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start === -1 || end <= start) throw new Error("No JSON object found")
    return JSON.parse(cleaned.slice(start, end + 1))
  }
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
    if (!(file instanceof File)) return Response.json({ error: "Upload a TXT evidence export." }, { status: 400 })
    const sourceText = await file.text()
    if (!sourceText.trim()) return Response.json({ error: "The uploaded TXT file is empty." }, { status: 400 })
    if (sourceText.length > 180000) return Response.json({ error: "This first version supports TXT exports up to 180,000 characters." }, { status: 413 })

    const response = await fetch(`${SARVAM_API}/v1/chat/completions`, {
      method: "POST",
      headers: { "api-subscription-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sarvam-105b",
        reasoning_effort: null,
        temperature: 0.1,
        max_tokens: 4000,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "case_evidence_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["overview", "entities", "claims", "events", "contradictions", "missingEvidence"],
              properties: {
                overview: { type: "string", maxLength: 600 },
                entities: {
                  type: "array", maxItems: 10,
                  items: {
                    type: "object", additionalProperties: false,
                    required: ["id", "name", "type", "aliases"],
                    properties: {
                      id: { type: "string" }, name: { type: "string", maxLength: 80 },
                      type: { type: "string", enum: ["person", "organization", "place", "other"] },
                      aliases: { type: "array", maxItems: 6, items: { type: "string", maxLength: 80 } },
                    },
                  },
                },
                claims: {
                  type: "array", maxItems: 12,
                  items: {
                    type: "object", additionalProperties: false,
                    required: ["id", "claim", "claimType", "speaker", "counterparty", "eventDate", "sourceRef", "confidence"],
                    properties: {
                      id: { type: "string" }, claim: { type: "string", maxLength: 240 },
                      claimType: { type: "string" }, speaker: { type: "string", maxLength: 80 },
                      counterparty: { type: "string", maxLength: 80 }, eventDate: { type: "string", maxLength: 40 },
                      sourceRef: { type: "string", maxLength: 160 }, confidence: { type: "number", minimum: 0, maximum: 1 },
                    },
                  },
                },
                events: {
                  type: "array", maxItems: 8,
                  items: {
                    type: "object", additionalProperties: false,
                    required: ["id", "title", "date", "description", "claimIds", "sourceRefs"],
                    properties: {
                      id: { type: "string" }, title: { type: "string", maxLength: 120 },
                      date: { type: "string", maxLength: 40 }, description: { type: "string", maxLength: 300 },
                      claimIds: { type: "array", maxItems: 8, items: { type: "string" } },
                      sourceRefs: { type: "array", maxItems: 8, items: { type: "string", maxLength: 160 } },
                    },
                  },
                },
                contradictions: {
                  type: "array", maxItems: 4,
                  items: {
                    type: "object", additionalProperties: false,
                    required: ["title", "explanation", "claimIds", "severity"],
                    properties: {
                      title: { type: "string", maxLength: 120 }, explanation: { type: "string", maxLength: 300 },
                      claimIds: { type: "array", maxItems: 4, items: { type: "string" } },
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                    },
                  },
                },
                missingEvidence: {
                  type: "array", maxItems: 4,
                  items: {
                    type: "object", additionalProperties: false,
                    required: ["title", "reason", "mentionedIn", "importance"],
                    properties: {
                      title: { type: "string", maxLength: 120 }, reason: { type: "string", maxLength: 300 },
                      mentionedIn: { type: "array", maxItems: 6, items: { type: "string", maxLength: 160 } },
                      importance: { type: "string", enum: ["low", "medium", "high"] },
                    },
                  },
                },
              },
            },
          },
        },
        messages: [
          {
            role: "system",
            content: `You are CaseLens, an evidence analysis engine for lawyers. Analyze evidence coverage, never decide legal truth. Return valid JSON only with this exact shape:
{"overview":"string","entities":[{"id":"P-01","name":"string","type":"person|organization|place|other","aliases":["string"]}],"claims":[{"id":"C-01","claim":"one atomic factual assertion","claimType":"payment_commitment|payment_claim|meeting|agreement|threat|delivery|identity|other","speaker":"string","counterparty":"string","eventDate":"ISO date or unknown","sourceRef":"exact WhatsApp line/message reference","confidence":0.0}],"events":[{"id":"E-01","title":"string","date":"ISO date or unknown","description":"string","claimIds":["C-01"],"sourceRefs":["exact reference"]}],"contradictions":[{"title":"string","explanation":"why directly comparable claims may conflict","claimIds":["C-01","C-02"],"severity":"low|medium|high"}],"missingEvidence":[{"title":"string","reason":"what is mentioned but absent and why it matters","mentionedIn":["source reference"],"importance":"low|medium|high"}]}.
Resolve aliases conservatively. Keep every claim atomic. Cluster claims that describe the same real-world event. Only flag genuine comparable conflicts. Every claim and event must preserve exact provenance.
Be concise. Prioritize only the most legally material content. Hard limits: at most 12 entities, 18 claims, 10 events, 6 contradictions, and 6 missing-evidence items. Keep overview under 80 words, each claim under 30 words, and every explanation under 50 words.`,
          },
          { role: "user", content: `Analyze this evidence text named "${file.name}". Source markers in square brackets identify the originating file; preserve them in sourceRef fields:\n\n${sourceText}` },
        ],
      }),
    })
    const body = await response.json()
    if (!response.ok) {
      const detail = Array.isArray(body?.detail) ? body.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(", ") : body?.detail
      const upstreamMessage = body?.error?.message || body?.error?.detail || body?.message || detail
      return Response.json({ error: upstreamMessage || `Sarvam analysis failed (${response.status}).` }, { status: response.status })
    }
    const content = body?.choices?.[0]?.message?.content
    if (!content) throw new Error("Sarvam returned an empty case analysis.")
    let analysis
    try {
      analysis = parseJson(content)
    } catch {
      const finishReason = body?.choices?.[0]?.finish_reason
      throw new Error(`Sarvam returned an invalid structured analysis${finishReason ? ` (${finishReason})` : ""}.`)
    }
    const saved = await saveCase({ title: file.name, sourceText, ...analysis })
    return Response.json(saved)
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : "Case analysis failed." }, { status: 500 })
  }
}
