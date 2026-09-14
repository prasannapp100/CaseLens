import { listKnowledge } from "@/lib/knowledge-base"

const SARVAM_API = "https://api.sarvam.ai"

export async function POST(request: Request) {
  const key = process.env.SARVAM_API_KEY
  if (!key) return Response.json({ error: "SARVAM_API_KEY is not configured." }, { status: 503 })
  const { question, history = [] } = await request.json()
  if (!question?.trim()) return Response.json({ error: "Enter a question." }, { status: 400 })
  const store = await listKnowledge()
  if (!store.items.length) return Response.json({ error: "Upload and process evidence before asking questions." }, { status: 400 })

  const evidence = store.items.map((item, index) =>
    `[SOURCE-${index + 1}] ${item.fileName}\n${item.translatedText || item.transcript}`,
  ).join("\n\n")
  const response = await fetch(`${SARVAM_API}/v1/chat/completions`, {
    method: "POST",
    headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sarvam-30b",
      reasoning_effort: null,
      temperature: 0.1,
      max_tokens: 700,
      messages: [
        { role: "system", content: `Answer only from the supplied case evidence.

Be direct and minimal:
- Answer the exact question first.
- Prefer 1 short paragraph or at most 3 bullets.
- Include only facts necessary to answer the question.
- Do not restate the question, summarize the whole case, add generic legal commentary, or list unrelated evidence.
- Cite [SOURCE-N] immediately after factual claims.
- If evidence is insufficient, say exactly what is missing in one sentence.
- Do not give a legal conclusion.

This is a continuing conversation. Resolve follow-up references such as "that payment", "he", "the second document", or "why?" using the preceding messages. Never treat previous assistant statements as evidence; the case evidence below remains authoritative.

CASE EVIDENCE:
${evidence}` },
        ...history.slice(-12).map((message: { role: string; content: string }) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: String(message.content || "").slice(0, 4000),
        })),
        { role: "user", content: question },
      ],
    }),
  })
  const body = await response.json()
  if (!response.ok) return Response.json({ error: body?.detail || body?.message || "Sarvam could not answer." }, { status: response.status })
  const answer = body?.choices?.[0]?.message?.content || ""
  const citedIds = new Set(
    Array.from(answer.matchAll(/\[SOURCE-(\d+)\]/gi), (match: RegExpMatchArray) => Number(match[1])),
  )
  return Response.json({
    answer,
    sources: store.items
      .map((item, index) => ({ id: index + 1, fileName: item.fileName }))
      .filter((source) => citedIds.has(source.id)),
  })
}
