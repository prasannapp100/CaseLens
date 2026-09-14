import { listCases } from "@/lib/case-store"
import { listKnowledge } from "@/lib/knowledge-base"

const SARVAM_API = "https://api.sarvam.ai"

export async function POST() {
  const key = process.env.SARVAM_API_KEY
  if (!key) return Response.json({ error: "SARVAM_API_KEY is not configured." }, { status: 503 })
  const [knowledge, cases] = await Promise.all([listKnowledge(), listCases()])
  if (!knowledge.items.length) return Response.json({ error: "Upload evidence before calculating case strength." }, { status: 400 })

  const evidence = {
    sources: knowledge.items.map((item) => ({
      fileName: item.fileName,
      mediaType: item.mediaType,
      languageCode: item.languageCode,
      transcriptExcerpt: (item.translatedText || item.transcript).slice(0, 2500),
      timedSegments: item.segments?.slice(0, 20),
    })),
    analyses: cases.slice(0, 8).map((item) => ({
      overview: item.overview,
      claims: item.claims,
      events: item.events,
      contradictions: item.contradictions,
      missingEvidence: item.missingEvidence,
    })),
  }

  const response = await fetch(`${SARVAM_API}/v1/chat/completions`, {
    method: "POST",
    headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sarvam-30b",
      reasoning_effort: null,
      temperature: 0.1,
      max_tokens: 4000,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "evidence_strength",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["score", "label", "explanation", "dimensions", "strengths", "weaknesses", "nextBestEvidence"],
            properties: {
              score: { type: "integer", minimum: 0, maximum: 100 },
              label: { type: "string", enum: ["Weak", "Developing", "Moderate", "Strong", "Very strong"] },
              explanation: { type: "string", maxLength: 500 },
              dimensions: {
                type: "array", minItems: 5, maxItems: 5,
                items: {
                  type: "object", additionalProperties: false,
                  required: ["name", "score", "reason"],
                  properties: {
                    name: { type: "string", enum: ["Source coverage", "Corroboration", "Consistency", "Provenance", "Completeness"] },
                    score: { type: "integer", minimum: 0, maximum: 100 },
                    reason: { type: "string", maxLength: 180 },
                  },
                },
              },
              strengths: { type: "array", maxItems: 4, items: { type: "string", maxLength: 180 } },
              weaknesses: { type: "array", maxItems: 4, items: { type: "string", maxLength: 180 } },
              nextBestEvidence: { type: "array", maxItems: 4, items: { type: "string", maxLength: 180 } },
            },
          },
        },
      },
      messages: [
        {
          role: "system",
          content: "You assess evidence coverage for a lawyer. Score only the strength and completeness of uploaded evidence, never likelihood of winning or legal merits. Penalize unsupported claims, contradictions, weak provenance, missing independent records, and single-source assertions. Reward independent corroboration, exact citations, timestamps, primary documents, and consistent accounts. Be conservative.",
        },
        { role: "user", content: `Assess this evidence workspace:\n${JSON.stringify(evidence)}` },
      ],
    }),
  })
  const body = await response.json()
  if (!response.ok) return Response.json({ error: body?.error?.message || body?.detail || body?.message || "Sarvam could not assess the evidence." }, { status: response.status })
  const content = body?.choices?.[0]?.message?.content
  if (!content) return Response.json({ error: "Sarvam returned an empty assessment." }, { status: 502 })
  try {
    if (typeof content === "object") return Response.json(content)
    const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/, "")
    try {
      return Response.json(JSON.parse(cleaned))
    } catch {
      const start = cleaned.indexOf("{")
      const end = cleaned.lastIndexOf("}")
      if (start === -1 || end <= start) throw new Error("No JSON object")
      return Response.json(JSON.parse(cleaned.slice(start, end + 1)))
    }
  } catch {
    return Response.json({ error: `Sarvam returned an invalid assessment${body?.choices?.[0]?.finish_reason ? ` (${body.choices[0].finish_reason})` : ""}.` }, { status: 502 })
  }
}
